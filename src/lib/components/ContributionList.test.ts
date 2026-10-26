import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { recordContribution, type Contribution } from '../client/contributions';
import ContributionList from './ContributionList.svelte';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const accepted: Contribution = {
  id: 'A'.repeat(128),
  uf: 'DF',
  municipio: 97012,
  zona: 11,
  secao: 178,
  urna: '2028869',
  enviadoEm: '2026-10-04T18:22:00.000Z',
  status: 'aceito'
};

describe('ContributionList', () => {
  it('invites a first submission when this device sent nothing', () => {
    render(ContributionList);

    expect(screen.getByText('Você ainda não enviou boletins.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Enviar o primeiro' })).toHaveAttribute('href', '/enviar');
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('lists what this device sent, newest first, with its outcome', () => {
    recordContribution(accepted);
    recordContribution({
      ...accepted,
      id: 'B'.repeat(128),
      secao: 179,
      urna: '2028870',
      status: 'conflito'
    });

    render(ContributionList);

    const [conflict, ok] = screen.getAllByRole('listitem') as [HTMLElement, HTMLElement];
    expect(within(conflict).getByText('Zona 11 · Seção 179 · Urna 2028870')).toBeInTheDocument();
    expect(within(conflict).getByText('Conflito')).toBeInTheDocument();
    expect(within(ok).getByText('Município 97012 – DF')).toBeInTheDocument();
    expect(within(ok).getByText('Zona 11 · Seção 178 · Urna 2028869')).toBeInTheDocument();
    expect(within(ok).getByText(new Date(accepted.enviadoEm).toLocaleString('pt-BR'))).toBeInTheDocument();
    expect(within(ok).getByText('Aceito')).toBeInTheDocument();
    expect(screen.queryByText('Você ainda não enviou boletins.')).not.toBeInTheDocument();
  });
});
