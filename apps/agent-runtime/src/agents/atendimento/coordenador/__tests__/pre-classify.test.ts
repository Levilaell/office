import { describe, expect, it } from 'vitest';
import { preClassify } from '../pre-classify.js';

describe('preClassify', () => {
  it('mensagem não-texto vira requer_humano', () => {
    const result = preClassify({
      contentTrimmed: '[audio enviado]',
      mediaType: 'audio',
    });
    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.intent).toBe('requer_humano');
    }
  });

  it('imagem também vira requer_humano', () => {
    const result = preClassify({
      contentTrimmed: '',
      mediaType: 'image',
    });
    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.intent).toBe('requer_humano');
    }
  });

  it('saudação curta classifica direto', () => {
    const cases = ['bom dia', 'oi', 'olá', 'Boa tarde!', 'opa', 'hey'];
    for (const text of cases) {
      const result = preClassify({ contentTrimmed: text, mediaType: 'text' });
      expect(result.handled, `falhou pra "${text}"`).toBe(true);
      if (result.handled) {
        expect(result.intent).toBe('social.saudacao');
      }
    }
  });

  it('agradecimento curto classifica direto', () => {
    const result = preClassify({
      contentTrimmed: 'obrigado!',
      mediaType: 'text',
    });
    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.intent).toBe('social.agradecimento');
    }
  });

  it('despedida curta classifica direto', () => {
    const result = preClassify({
      contentTrimmed: 'tchau, até mais',
      mediaType: 'text',
    });
    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.intent).toBe('social.despedida');
    }
  });

  it('mensagem longa com saudação NÃO classifica direto (vai pra LLM)', () => {
    const result = preClassify({
      contentTrimmed:
        'Bom dia! Gostaria de saber se vocês fazem a ECD da minha empresa',
      mediaType: 'text',
    });
    expect(result.handled).toBe(false);
  });

  it('mensagem curta sem padrão social vai pra LLM', () => {
    const result = preClassify({
      contentTrimmed: 'DAS atrasou',
      mediaType: 'text',
    });
    expect(result.handled).toBe(false);
  });

  it('texto vazio vai pra LLM (sem prejuízo)', () => {
    const result = preClassify({
      contentTrimmed: '',
      mediaType: 'text',
    });
    expect(result.handled).toBe(false);
  });

  it('system_event tratado como texto', () => {
    const result = preClassify({
      contentTrimmed: 'oi',
      mediaType: 'system_event',
    });
    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.intent).toBe('social.saudacao');
    }
  });
});
