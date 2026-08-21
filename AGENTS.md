# Instagram Carousel Template

## Como usar

Diga: "faz um carrossel sobre [tema]" com as imagens e textos.

O script está em `carousel_template.py` no raiz do projeto.

## Template (aproved design)

- **Dimensão:** 1080×1350px (4:5 Instagram)
- **Fundo:** Preto `#000000`
- **Imagem:** Topo ~50% da tela, com gradiente fade para preto na borda inferior
- **Fontes:**
  - **Título:** Libre Baskerville (serifa, elegante), cor branca, tamanho 62px
  - **Corpo:** Inter SemiBold, cor branca, tamanho 34px
- **Logo:** `logo-x.png` (~/Downloads/) no canto inferior direito, preto e branco
- **Número do slide:** Canto inferior esquerdo, cinza escuro
- **Sem** linhas vermelhas, sem traços, sem bordas, sem travessões (—) no texto

## Instruções para o agente

1. Receber as imagens (URLs) e o texto do usuário
2. Baixar as imagens para `/tmp/`
3. Editar `carousel_template.py`:
   - Atualizar `title_lines` e `body_lines` na seção `if __name__`
   - Atualizar `photo_path` com a imagem correta
   - Atualizar `output_path` e `slide_num`
4. Executar `python3 carousel_template.py`
5. Mostrar o resultado ao usuário

## Para múltiplos slides

Chamar `create_premium_slide()` para cada slide, mudando:
- `title_lines` — 2-3 linhas máx
- `body_lines` — 1-2 linhas curtas
- `slide_num` — "1/5", "2/5", etc.
- `output_path` — `/tmp/carousel_slide_02.jpg`, etc.
