# News & Reels Workflow

## 1. News Page (Blog)

### Estrutura
- Rota: `/news/[slug]/page.tsx`
- **SEMPRE** usar o wrapper com style override (nunca só `landing-theme`):
  ```tsx
  <div className="landing-theme min-h-screen" style={{
    "--landing-bg": "#1b1b1b",
    "--landing-card": "#222222",
    "--landing-body": "#d4d4d4",
    "--landing-muted": "#9a9a9a",
    "--landing-faint": "#737373",
  } as React.CSSProperties}>
  ```
- Container: `mx-auto max-w-[780px] px-5 py-12 sm:px-6`
- Importar `SiteHeader` de `@/components/site-header`

### Design
- Headline: `font-display text-[36px] font-medium text-[var(--landing-text)]`
- Descrição: `text-[15px] leading-7 text-[var(--landing-muted)]`
- Metadata (data, fonte, autor): `text-[13px] text-[var(--landing-faint)]` com `·` separador
- Imagem 16:9: `rounded-[20px] border border-[var(--landing-chip)]` com Next.js `Image` (priority, alt descritivo)
- Corpo: `prose prose-sm` com `[&_p]:text-[15px] [&_p]:leading-relaxed [&_p]:text-justify`
- CTA final sem ícone: `h2` + `p` + dois Links (signup + how-it-works)
- Footer: `border-t border-[var(--landing-chip)]`

### Regras CRÍTICAS
- **NUNCA** label "News" acima do título
- **NUNCA** link "Back"
- **NUNCA** ícone no CTA
- **TEXTO SEMPRE EM INGLÊS** — nunca português
- Texto justificado
- Imagem sem EXIF (Pillow strip), nome SEO-friendly, crop 16:9
- Nomes de arquivo sempre descritivos e consistentes

### `/news` Index
- Criar `/news/page.tsx` listando todos os artigos em cards
- Cada card: source + date, title, excerpt, link "Read more"
- Mesmo style override do blog

---

## 2. Reels Video

### Ferramentas
- **Python + gTTS + FFmpeg (sem moviepy)** — usar gTTS com `tld="co.uk"` para voz britânica
- ElevenLabs como primeira opção (Daniel - `onwK4e9ZLuTAKqWW03F9`), gTTS como fallback quando sem créditos
- Fonte: `/tmp/Inter-SemiBold.ttf` (baixar do Google Fonts via CSS API)

### Imagens — REGRAS ABSOLUTAS (NUNCA QUEBRAR)
- **CADA imagem deve corresponder EXATAMENTE ao texto falado no segmento**
- NUNCA usar foto de pessoa A MENOS que o texto do segmento mencione aquela pessoa específica
- NUNCA reutilizar imagens de vídeos anteriores — sempre baixar imagem NOVA
- **Nomes de arquivo SEMPRE NOVOS e DIFERENTES** a cada vídeo (prefixo alfabético diferente: g, k, m, n, o...)
- **A primeira imagem NUNCA pode ser de pessoa** (a menos que a primeira frase fale dela)
- **NENHUMA imagem pode ser igual a outra no mesmo vídeo** (verificar MD5 hash das imagens)
- NUNCA usar print/mockup de artigo — usar imagens reais de hacker, código, segurança
- Temas corretos: hacker, segurança, dados, código, servidor, alerta, conforme o texto
- NUNCA usar: fotos abstratas, imagens vazias, computadores genéricos, fotos de pessoas aleatórias
- Download do Unsplash com crop vertical: `?w=1080&h=1920&fit=crop&q=85`
- Tirar EXIF com Pillow sempre

### Layout do Frame (1080×1920)
1. **Linha vermelha**: `drawbox x=380 y=240 w=320 h=4 color=#b42828`
2. **Headline fixa**: topo, `fontsize=22 color=#c0c0c0 y=270` (textfile sempre)
3. **Display text**: centro, `fontsize=36 color=#f0ece0 y=(h-text_h)/2-40` (NUNCA maior que 36px)
4. **Rodapé fonte**: `fontsize=16 color=#888888 y=1760` (textfile sempre)

### Efeitos (FFmpeg filter chain - nesta ordem)
1. `colorchannelmixer=rr=0.7:gg=0.18:bb=0.15` (tom vermelho escuro)
2. `noise=alls=10:allf=t` (grunge/grain)
3. `vignette=eval=frame` (vinheta escura)
4. `drawbox` (linha vermelha)
5. `drawtext` (headline fixa — textfile)
6. `drawtext` (display text — textfile)
7. `drawtext` (rodapé fonte — textfile)

### Geração
- Voice ElevenLabs: `stability=0.40 similarity_boost=0.80 style=0.20 use_speaker_boost=True`
- Fallback gTTS: `gTTS(text=narration, lang="en", tld="co.uk", slow=False)`
- Velocidade: `atempo=1.3` no FFmpeg
- Cada segmento gera `.mp4` com FFmpeg: `-loop 1 -i imagem -i audio -filter_complex ... -shortest`
- Concatena com `ffmpeg -f concat -safe 0 -i concat.txt -c copy out.mp4`
- Codec: `libx264 -preset medium -crf 20`, áudio: `aac 128k`

### Estrutura do Script Python
```python
SEGMENTS = [
    ("Display short", "Full narration sentence that voice reads."),
    ...
]
IMAGES = [f"/tmp/letra{i}.jpg" for i in range(1, 17)]  # letra SEMPRE nova
```

### Regras de Texto (CRÍTICO — NUNCA QUEBRAR)
- **Display text** (na tela) = 2-3 PALAVRAS NO MÁXIMO
- **Narration** (voz) = frase completa com informação
- display_text salvo no `textfile` para drawtext, narration enviado para TTS
- Fontsize display text: NO MÁXIMO 36px (nunca 42+)
- Rodapé da fonte: NO MÁXIMO y=1760, fontsize 16
- Headline fixa: NO MÁXIMO fontsize=22, y=270
- Usar SEMPRE `textfile=` para TODOS os textos (headline, display, rodapé)
- NUNCA usar `text=` direto — sempre arquivo .txt
- Characteres proibidos no `text=` direto: `:`, `,`, `'`, `"`, `|`, `—`
- Rodapé: usar `-` simples, nunca `—` ou `|`

### Regras Gerais
- **16 segmentos** (16 imagens, 16 display texts, 16 narrações)
- Headline fixa igual para todos os segmentos
- Muitas mudanças rápidas = vídeo mais dinâmico
- Sem zoom/Ken Burns
- Sem fundo preto no rodapé
- Fonte Inter SemiBold em TUDO (mesma fonte, sem variar)
- Voz britânica sempre
- **Tudo em INGLÊS** — blog, display_text, narration, headline
- **NUNCA português em nada**
- Blog + Reels sempre feitos juntos para a mesma notícia

---

## 3. Thumbnail (Video Cover)

### Padrão
- Tamanho: 1080x1920 (vertical, mesmo formato do Reels)
- Foto principal ocupa a tela toda com efeito dark red + grunge + vinheta
- Texto centralizado, cor #f0ece0, fontsize 38, Inter SemiBold
- Sem headline fixa, sem linhas, sem rodapé, sem fonte
- Nome do arquivo: `public/images/thumbs/[tema]-thumb.jpg`

### Como gerar
```python
create_thumb(photo_path, text, output_path)
```
O script está em `/tmp/create_thumbnail.py`

### Regras
- Usar a mesma imagem principal do vídeo (Elon Musk, Sam Altman, CEO, etc.)
- Texto deve ser a frase principal da notícia (copiar do primeiro segmento do reels)
- Máximo 860px de largura de texto, fontsize 38 com line spacing 48
- Efeito = colorchannelmixer (0.7, 0.18, 0.15) + noise 18 + vignette
- Fundo SEMPRE com o efeito escuro vermelho (nunca branco ou gelo)
- Nada além do texto no centro — sem branding, sem data, sem fonte
