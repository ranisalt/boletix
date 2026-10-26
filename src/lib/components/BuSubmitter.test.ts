import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { flushSync } from 'svelte';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadBuFixture } from '../bu/fixtures';
import { chainHashes } from '../bu/verify';
import { ScanSession } from '../client/scan-session.svelte';
import BuSubmitter from './BuSubmitter.svelte';

const fixture = loadBuFixture('df-97012-11-178');
const [buQr] = fixture.qrbu as [string];
const [cert1, cert2] = fixture.qrce as [string, string];

function multiPart(total: number): string[] {
  const body = buQr.replace(/^QRBU:1:1 VRQR:6\.0 /, '').replace(/ HASH:.*$/, '');
  const tokens = body.split(' ');
  const size = Math.ceil(tokens.length / total);
  const contents = Array.from({ length: total }, (_, i) => tokens.slice(i * size, (i + 1) * size).join(' '));
  const hashes = chainHashes(contents);
  return contents.map((content, i) => `QRBU:${i + 1}:${total} VRQR:6.0 ${content} HASH:${hashes[i]}${i === total - 1 ? ' ASSI:00' : ''}`);
}

const received: unknown[] = [];
let reply: () => Response = () => HttpResponse.json({ status: 'new', hash: 'A'.repeat(128) }, { status: 201 });
const server = setupServer(
  http.post('*/api/submissions', async ({ request }) => {
    received.push(await request.json());
    return reply();
  })
);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  received.length = 0;
});
afterAll(() => server.close());

function setup() {
  const session = new ScanSession();
  render(BuSubmitter, { session });
  const scan = (...raws: string[]) => flushSync(() => raws.forEach((raw) => session.add(raw)));
  return { session, scan };
}

function items(listName: string): string[] {
  return within(screen.getByRole('list', { name: listName }))
    .getAllByRole('listitem')
    .map((item) => item.textContent?.replace(/\s+/g, ' ').trim() ?? '');
}

describe('BuSubmitter', () => {
  it('asks for any BU QR first and shows two pending certificate parts', () => {
    setup();

    expect(screen.getByText('Escaneie qualquer QR code do boletim para saber quantos são.')).toBeInTheDocument();
    expect(items('Certificado digital da urna')).toEqual(['Parte 1 de 2: pendente', 'Parte 2 de 2: pendente']);
  });

  it('pre-renders one slot per BU QR once any of them is scanned', () => {
    const { scan } = setup();
    scan(multiPart(3)[1]!);

    expect(items('QR codes do boletim')).toEqual(['QR 1 de 3: pendente', 'QR 2 de 3: lido', 'QR 3 de 3: pendente']);
    expect(screen.queryByRole('button', { name: 'Enviar boletim' })).not.toBeInTheDocument();
  });

  it('verifies the signature once complete and shows which section it is', () => {
    const { scan } = setup();
    scan(cert2, buQr, cert1);

    expect(screen.getByText('Assinatura verificada: boletim autêntico da urna 2028869.')).toBeInTheDocument();
    expect(screen.getByText('DF · município 97012 · zona 11 · seção 178')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar boletim' })).toBeEnabled();
  });

  it('explains a failed verification and offers to start over instead of sending', async () => {
    const { scan } = setup();
    scan(buQr, ...loadBuFixture('zz-29386-1-1709').qrce);

    expect(screen.getByRole('alert')).toHaveTextContent('O certificado digital é de outra urna.');
    expect(screen.queryByRole('button', { name: 'Enviar boletim' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Recomeçar' }));
    expect(screen.getByText('Escaneie qualquer QR code do boletim para saber quantos são.')).toBeInTheDocument();
  });

  it('sends exactly the verified submission and confirms it', async () => {
    const { session, scan } = setup();
    scan(buQr, cert1, cert2);
    const verification = session.verify();

    await fireEvent.click(screen.getByRole('button', { name: 'Enviar boletim' }));

    expect(await screen.findByText('Boletim enviado. Obrigado!')).toBeInTheDocument();
    expect(received).toEqual([verification.ok && verification.submission]);
    expect(screen.queryByRole('button', { name: 'Enviar boletim' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Escanear outro boletim' }));
    expect(screen.getByText('Escaneie qualquer QR code do boletim para saber quantos são.')).toBeInTheDocument();
  });

  it.each([
    [() => HttpResponse.json({ status: 'duplicate' }, { status: 200 }), 'Este boletim já tinha sido enviado. Nada mudou.'],
    [
      () => HttpResponse.json({ status: 'conflict' }, { status: 409 }),
      'Já recebemos um boletim diferente para esta seção. Mantivemos o primeiro e avisamos a equipe.'
    ],
    [
      () => HttpResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 422 }),
      'A assinatura digital não confere: o boletim pode ter sido alterado.'
    ],
    [() => HttpResponse.json({ error: 'RATE_LIMITED' }, { status: 429 }), 'Muitos envios seguidos. Aguarde um minuto e tente novamente.'],
    [() => new HttpResponse('oops', { status: 500 }), 'O servidor não conseguiu processar o envio. Tente novamente mais tarde.'],
    [() => HttpResponse.error(), 'Não foi possível enviar. Verifique sua conexão e tente novamente.']
  ])('tells the user how the server answered (%#)', async (response, message) => {
    reply = response;
    const { scan } = setup();
    scan(buQr, cert1, cert2);

    await fireEvent.click(screen.getByRole('button', { name: 'Enviar boletim' }));

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('lets the user retry after a network failure', async () => {
    reply = () => HttpResponse.error();
    const { scan } = setup();
    scan(buQr, cert1, cert2);
    await fireEvent.click(screen.getByRole('button', { name: 'Enviar boletim' }));
    await screen.findByText('Não foi possível enviar. Verifique sua conexão e tente novamente.');

    reply = () => HttpResponse.json({ status: 'new' }, { status: 201 });
    await fireEvent.click(screen.getByRole('button', { name: 'Enviar boletim' }));

    expect(await screen.findByText('Boletim enviado. Obrigado!')).toBeInTheDocument();
  });

  it('tells browsers without camera access that scanning is unavailable', () => {
    setup();

    expect(
      screen.getByText('Seu navegador não consegue ler QR codes pela câmera. Use um navegador atualizado para enviar boletins.')
    ).toBeInTheDocument();
  });
});
