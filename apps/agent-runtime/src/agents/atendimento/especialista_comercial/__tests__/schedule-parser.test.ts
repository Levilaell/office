import { describe, expect, it } from 'vitest';
import { hasScheduleHint, parseScheduleSuggestion } from '../schedule-parser';

describe('hasScheduleHint', () => {
  it('detecta dias da semana', () => {
    expect(hasScheduleHint('terça de manhã')).toBe(true);
    expect(hasScheduleHint('Segunda à tarde')).toBe(true);
    expect(hasScheduleHint('fim de semana')).toBe(true);
    expect(hasScheduleHint('final de semana')).toBe(true);
    expect(hasScheduleHint('amanhã')).toBe(true);
    expect(hasScheduleHint('hoje à noite')).toBe(true);
  });

  it('detecta tokens de período', () => {
    expect(hasScheduleHint('Pode ser de manhã?')).toBe(true);
    expect(hasScheduleHint('tarde de qualquer dia')).toBe(true);
    expect(hasScheduleHint('na parte da noite')).toBe(true);
  });

  it('detecta horários explícitos', () => {
    expect(hasScheduleHint('14h fica bom')).toBe(true);
    expect(hasScheduleHint('14:30')).toBe(true);
    expect(hasScheduleHint('às 9h')).toBe(true);
    expect(hasScheduleHint('às 16:00')).toBe(true);
  });

  it('não falsa em texto sem horário', () => {
    expect(hasScheduleHint('quanto custa?')).toBe(false);
    expect(hasScheduleHint('quero saber sobre os serviços')).toBe(false);
    expect(hasScheduleHint('não entendi')).toBe(false);
  });

  it('detecta "semana que vem"', () => {
    expect(hasScheduleHint('semana que vem talvez')).toBe(true);
    expect(hasScheduleHint('próxima semana')).toBe(true);
  });
});

describe('parseScheduleSuggestion', () => {
  it('retorna scheduledAt=null (parser robusto é TD)', () => {
    const r = parseScheduleSuggestion('terça às 14h');
    expect(r.scheduledAt).toBeNull();
  });

  it('preserva texto em notes (trim + slice 200)', () => {
    const r = parseScheduleSuggestion('  terça de manhã pra mim   ');
    expect(r.notes).toBe('terça de manhã pra mim');
  });

  it('trunca notes em 200 chars', () => {
    const long = 'a'.repeat(300);
    const r = parseScheduleSuggestion(long);
    expect(r.notes.length).toBe(200);
  });
});
