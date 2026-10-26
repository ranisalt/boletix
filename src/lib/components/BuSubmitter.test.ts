import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { flushSync } from 'svelte';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { loadBuFixture } from '../bu/fixtures';
import { chainHashes } from '../bu/verify';
import { listContributions } from '../client/contributions';
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
  localStorage.clear();
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

const WAITING = 'Leia qualquer QR code do boletim para descobrir quantas partes ele tem. A ordem não importa.';

describe('BuSubmitter', () => {
  it('asks for any BU QR first and shows two pending certificate parts', () => {
    setup();

    expect(screen.getByText(WAITING)).toBeInTheDocument();
    expect(items('Certificado digital')).toEqual(['Certificado 1 de 2 pendente', 'Certificado 2 de 2 pendente']);
  });

  it('pre-renders one slot per BU QR once any of them is scanned', () => {
    const { scan } = setup();
    scan(multiPart(3)[1]!);

    expect(items('QR codes do boletim')).toEqual(['Parte 1 de 3 pendente', 'Parte 2 de 3 lido', 'Parte 3 de 3 pendente']);
    expect(screen.queryByRole('button', { name: 'Enviar boletim' })).not.toBeInTheDocument();
  });

  it('verifies the signature once complete and shows which section it is', () => {
    const { scan } = setup();
    scan(cert2, buQr, cert1);

    expect(screen.getByText('Assinatura verificada')).toBeInTheDocument();
    const terms = screen.getAllByRole('term').map((term) => term.textContent);
    const values = screen.getAllByRole('definition').map((value) => value.textContent);
    expect(Object.fromEntries(terms.map((term, i) => [term, values[i]]))).toEqual({
      UF: 'DF',
      Município: '97012',
      Zona: '11',
      Seção: '178',
      Urna: '2028869'
    });
    expect(screen.getByRole('button', { name: 'Enviar boletim' })).toBeEnabled();
  });

  it('explains a failed verification and offers to start over instead of sending', async () => {
    const { scan } = setup();
    scan(buQr, ...loadBuFixture('zz-29386-1-1709').qrce);

    expect(
      screen.getByRole('alert', {
        name: 'Não foi possível verificar o boletim'
      })
    ).toHaveTextContent('O certificado digital é de outra urna.');
    expect(screen.queryByRole('button', { name: 'Enviar boletim' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Recomeçar' }));
    expect(screen.getByText(WAITING)).toBeInTheDocument();
  });

  it('sends exactly the verified submission, confirms it and remembers it on this device', async () => {
    const { session, scan } = setup();
    scan(buQr, cert1, cert2);
    const verification = session.verify();

    await fireEvent.click(screen.getByRole('button', { name: 'Enviar boletim' }));

    expect(await screen.findByRole('status', { name: 'Boletim enviado' })).toHaveTextContent('Obrigado! Ele foi verificado e guardado.');
    expect(received).toEqual([verification.ok && verification.submission]);
    expect(screen.queryByRole('button', { name: 'Enviar boletim' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Minhas contribuições' })).toHaveAttribute('href', '/contribuicoes');
    expect(listContributions()).toEqual([
      expect.objectContaining({
        uf: 'DF',
        municipio: 97012,
        zona: 11,
        secao: 178,
        urna: '2028869',
        status: 'aceito'
      })
    ]);

    await fireEvent.click(screen.getByRole('button', { name: 'Escanear outro' }));
    expect(screen.getByText(WAITING)).toBeInTheDocument();
  });

  it.each([
    [
      () => HttpResponse.json({ status: 'duplicate' }, { status: 200 }),
      'Este boletim já foi enviado',
      'Alguém já enviou este mesmo boletim. Nada mais a fazer.'
    ],
    [
      () => HttpResponse.json({ status: 'conflict' }, { status: 409 }),
      'Conflito detectado',
      'Já recebemos um boletim diferente para esta seção. Mantivemos o primeiro e avisamos a equipe.'
    ],
    [
      () => HttpResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 422 }),
      'Assinatura inválida',
      'A assinatura digital não confere: o boletim pode ter sido alterado.'
    ],
    [
      () => HttpResponse.json({ error: 'HASH_MISMATCH' }, { status: 422 }),
      'Boletim recusado',
      'O conteúdo do boletim não confere com o hash impresso.'
    ],
    [
      () => HttpResponse.json({ error: 'RATE_LIMITED' }, { status: 429 }),
      'Limite de envios atingido',
      'Muitos envios seguidos. Aguarde um minuto e tente novamente.'
    ],
    [
      () => new HttpResponse('oops', { status: 500 }),
      'Erro de servidor ou rede',
      'O servidor não conseguiu processar o envio. Tente novamente mais tarde.'
    ],
    [() => HttpResponse.error(), 'Erro de servidor ou rede', 'Não foi possível enviar. Verifique sua conexão e tente novamente.']
  ])('tells the user how the server answered (%#)', async (response, title, message) => {
    reply = response;
    const { scan } = setup();
    scan(buQr, cert1, cert2);

    await fireEvent.click(screen.getByRole('button', { name: 'Enviar boletim' }));

    expect(await screen.findByRole('status', { name: title })).toHaveTextContent(message);
  });

  it('remembers a conflicting boletim as a conflict, and an already-known one not at all', async () => {
    reply = () => HttpResponse.json({ status: 'conflict' }, { status: 409 });
    const { scan } = setup();
    scan(buQr, cert1, cert2);
    await fireEvent.click(screen.getByRole('button', { name: 'Enviar boletim' }));
    await screen.findByRole('status', { name: 'Conflito detectado' });
    expect(listContributions()).toEqual([expect.objectContaining({ status: 'conflito' })]);

    localStorage.clear();
    reply = () => HttpResponse.json({ status: 'duplicate' }, { status: 200 });
    await fireEvent.click(screen.getByRole('button', { name: 'Escanear outro' }));
    scan(buQr, cert1, cert2);
    await fireEvent.click(screen.getByRole('button', { name: 'Enviar boletim' }));
    await screen.findByRole('status', { name: 'Este boletim já foi enviado' });
    expect(listContributions()).toEqual([]);
  });

  it('lets the user retry after a network failure', async () => {
    reply = () => HttpResponse.error();
    const { scan } = setup();
    scan(buQr, cert1, cert2);
    await fireEvent.click(screen.getByRole('button', { name: 'Enviar boletim' }));
    await screen.findByRole('status', { name: 'Erro de servidor ou rede' });

    reply = () => HttpResponse.json({ status: 'new' }, { status: 201 });
    await fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Enviar boletim' }));

    expect(await screen.findByRole('status', { name: 'Boletim enviado' })).toBeInTheDocument();
  });

  it('offers no retry when the server rejected the boletim itself', async () => {
    reply = () => HttpResponse.json({ error: 'SIGNATURE_INVALID' }, { status: 422 });
    const { scan } = setup();
    scan(buQr, cert1, cert2);
    await fireEvent.click(screen.getByRole('button', { name: 'Enviar boletim' }));
    await screen.findByRole('status', { name: 'Assinatura inválida' });

    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
  });

  it('tells browsers without camera access that scanning is unavailable', () => {
    setup();

    expect(screen.getByRole('alert', { name: 'Navegador não suportado' })).toHaveTextContent(
      'Seu navegador não permite acesso à câmera. Use uma versão recente do Chrome, Firefox ou Safari.'
    );
  });
});
