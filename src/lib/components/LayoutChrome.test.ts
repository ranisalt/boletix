import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import NoticeBanner from './NoticeBanner.svelte';
import ThemeToggle from './ThemeToggle.svelte';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

const DISCLAIMER = /Boletix NÃO é um serviço oficial/;

describe('NoticeBanner', () => {
  it('warns that Boletix is not official until the visitor acknowledges it, and remembers that', async () => {
    render(NoticeBanner);

    expect(screen.getByRole('region', { name: 'Aviso importante' })).toHaveTextContent(DISCLAIMER);
    await fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('region', { name: 'Aviso importante' })).not.toBeInTheDocument();

    cleanup();
    render(NoticeBanner);
    expect(screen.queryByRole('region', { name: 'Aviso importante' })).not.toBeInTheDocument();
  });
});

describe('ThemeToggle', () => {
  it('switches to the other theme and keeps the choice for the next visit', async () => {
    render(ThemeToggle);

    await fireEvent.click(screen.getByRole('button', { name: 'Usar tema escuro' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('boletix:theme')).toBe('dark');

    await fireEvent.click(screen.getByRole('button', { name: 'Usar tema claro' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('boletix:theme')).toBe('light');
  });

  it('starts from the theme already applied before hydration', () => {
    document.documentElement.classList.add('dark');
    render(ThemeToggle);

    expect(screen.getByRole('button', { name: 'Usar tema claro' })).toBeInTheDocument();
  });
});
