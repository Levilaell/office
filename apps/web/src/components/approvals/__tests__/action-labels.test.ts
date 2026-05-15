import { describe, expect, it } from 'vitest';
import { getActionLabel, humanizeAction } from '../../../lib/action-labels';

describe('getActionLabel', () => {
  it('retorna label PT-BR mapeado pra submit_obligation', () => {
    expect(getActionLabel('submit_obligation')).toBe('Transmitir obrigação');
  });

  it('retorna label mapeado pra send_email', () => {
    expect(getActionLabel('send_email')).toBe('Enviar email');
  });

  it('retorna label mapeado pra register_alteration', () => {
    expect(getActionLabel('register_alteration')).toBe('Registrar alteração societária');
  });

  it('retorna label mapeado pra close_period', () => {
    expect(getActionLabel('close_period')).toBe('Fechar competência');
  });

  it('humaniza snake_case desconhecido capitalizando primeira palavra', () => {
    expect(getActionLabel('emit_certificate')).toBe('Emit certificate');
  });

  it('lida com action_type vazio retornando placeholder', () => {
    expect(getActionLabel('')).toBe('Ação');
  });
});

describe('humanizeAction', () => {
  it('capitaliza primeira palavra de snake_case', () => {
    expect(humanizeAction('do_something_fancy')).toBe('Do something fancy');
  });

  it('preserva palavra única', () => {
    expect(humanizeAction('approve')).toBe('Approve');
  });

  it('lida com string vazia', () => {
    expect(humanizeAction('')).toBe('Ação');
  });
});
