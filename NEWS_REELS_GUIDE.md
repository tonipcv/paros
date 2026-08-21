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

## 2. Reels Video — FORMATO PADRÃO (v8+)

### Visão Geral do Fluxo
```
1. Definir 10 segmentos (imagem + narração)
2. Baixar/cropar imagens para 1080×1920
3. Gerar 1 áudio ÚNICO contínuo (Fish Audio, 1 chamada só)
4. Gerar 10 vídeos SEM áudio (video-only) com efeitos + headline
5. Concatenar vídeos
6. Adicionar áudio único ao vídeo final
7. Gerar thumbnail
```

### Ferramentas
- **Python + FFmpeg (sem moviepy)**
- **Fish Audio** (voz principal): API key `2decb955bc8b492ea5b94d75cee5d2e0`, modelo `s2.1-pro-free`, endpoint `https://api.fish.audio/v1/tts`
  - **Inglês (britânico):** `reference_id: "e5f3047b09ab468da84ca21e3f511680"` ("british male calm voice")
  - **Português (brasileiro):** **sem** `reference_id` (usa voz padrão do modelo)
- **Fonte:** `/tmp/Inter-SemiBold.ttf` (baixar do Google Fonts via CSS API)
- **Script de thumbnail:** `/tmp/create_thumbnail.py`

### Layout do Frame (1080×1920) — Forbes-style
```
1. drawbox x=140 y=280 w=300 h=3 color=#b42828       (linha vermelha, 60px acima da headline)
2. drawtext textfile=hl_0.txt fontsize=32 color=#f0ece0 x=140 y=340   (headline linha 1)
3. drawtext textfile=hl_1.txt fontsize=32 color=#f0ece0 x=140 y=384   (headline linha 2)
4. drawtext textfile=hl_2.txt fontsize=32 color=#f0ece0 x=140 y=428   (headline linha 3)
5. drawtext textfile=source.txt fontsize=15 color=#888888 x=centro y=1780  (rodapé)
```

**Regras:**
- Headline: 3 linhas MÁX, lado esquerdo `x=140`, `fontsize=32`, `line_height=44`
- **NUNCA** usar display text central
- Headline usa `textfile=` (arquivo .txt), nunca `text='...'` inline (evita problemas com caracteres especiais)
- Rodapé: `y=1780`, `fontsize=15`

### Efeitos (FFmpeg filter chain — nesta ordem)
```
colorchannelmixer=rr=0.7:gg=0.18:bb=0.15,noise=alls=10:allf=t,vignette=eval=frame
```

### PASSOS DETALHADOS

#### Passo 1: Definir Segmentos
```python
SEGMENTS = [
    ("BREAKING", "Hugging Face used a Chinese AI model to defend against the OpenAI hack.", "img1.jpg"),
    ("OPENAI HACK", "Attackers breached OpenAI exposing millions of users.", "img2.jpg"),
    ... 10 segmentos no total
]
```
- Cada segmento: (título_ref, narração, imagem)
- Narração: ~10-12 palavras, ~3-4s de fala cada
- Imagens: baixadas e salvas em `/tmp/hf_reel/`
- A primeira imagem aparece APENAS no primeiro segmento

#### Passo 2: Headline Forbes-style
```python
headline_lines = [
    "HUGGING FACE FORCED TO USE CHINESE AI",
    "AFTER US MODELS REFUSED HELP IN",
    "OPENAI HACK INVESTIGATION"
]
```
- Escrever cada linha em `hl_0.txt`, `hl_1.txt`, `hl_2.txt`
- Usar `textfile=` (NUNCA inline) para evitar erros com `:` e `'`

#### Passo 3: Preparar Imagens
```python
for i, (_, _, img_name) in enumerate(SEGMENTS):
    img = Image.open(img_name).convert("RGB")
    ratio = max(1080/img.width, 1920/img.height)
    img = img.resize((int(img.width*ratio), int(img.height*ratio)), Image.LANCZOS)
    left, top = (new_w - 1080)//2, (new_h - 1920)//2
    img = img.crop((left, top, left+1080, top+1920))
    img.save(f"frame_{i:02d}.jpg", "JPEG", quality=92, exif=b"")
```
- Crop center para 1080×1920
- Sempre remover EXIF

#### Passo 4: Gerar Áudio ÚNICO
```python
FULL_NARRATION = " ".join(s[1] for s in SEGMENTS)

# Inglês (britânico):
body = {"text": FULL_NARRATION, "reference_id": "e5f3047b09ab468da84ca21e3f511680", "format": "mp3"}

# Português (brasileiro):
body = {"text": FULL_NARRATION, "format": "mp3"}  # sem reference_id

# Chamada Fish Audio:
POST https://api.fish.audio/v1/tts
Headers: Authorization: Bearer 2decb955bc8b492ea5b94d75cee5d2e0
         Content-Type: application/json
         model: s2.1-pro-free
Body: JSON acima
Response: MP3 binário (salvar direto)
```
- **SEMPRE 1 chamada só** — voz contínua e consistente

#### Passo 5: Gerar Segmentos (video-only)
```bash
ffmpeg -y -loop 1 -i frame_{i}.jpg \
  -vf "colorchannelmixer=rr=0.7:gg=0.18:bb=0.15,\
       noise=alls=10:allf=t,\
       vignette=eval=frame,\
       drawbox=x=140:y=280:w=300:h=3:color=#b42828,\
       drawtext=textfile=hl_0.txt:fontfile=Inter-SemiBold.ttf:fontsize=32:fontcolor=#f0ece0:x=140:y=340,\
       drawtext=textfile=hl_1.txt:fontfile=Inter-SemiBold.ttf:fontsize=32:fontcolor=#f0ece0:x=140:y=384,\
       drawtext=textfile=hl_2.txt:fontfile=Inter-SemiBold.ttf:fontsize=32:fontcolor=#f0ece0:x=140:y=428,\
       drawtext=textfile=source.txt:fontfile=Inter-SemiBold.ttf:fontsize=15:fontcolor=#888888:x=(w-text_w)/2:y=1780" \
  -an -c:v libx264 -preset medium -crf 20 -t 4 -pix_fmt yuv420p seg_{i}.mp4
```
- `-an` = sem áudio
- `-t 4` = 4 segundos por segmento (10 × 4s = 40s)

#### Passo 6: Concatenar Vídeos
```bash
# Criar concat.txt com:
# file '/tmp/hf_reel/seg_00.mp4'
# file '/tmp/hf_reel/seg_01.mp4'
# ... até seg_09.mp4

ffmpeg -y -f concat -safe 0 -i concat.txt -c copy video_only.mp4
```

#### Passo 7: Adicionar Áudio
```bash
ffmpeg -y -i video_only.mp4 -i audio.mp3 \
  -c:v copy -c:a aac -b:a 192k \
  -map 0:v:0 -map 1:a:0 \
  -t 40 final.mp4
```
- `-t 40` garante exatamente 40s

### Thumbnail
```bash
python3 /tmp/create_thumbnail.py
```
Script configurado com foto + texto. Parâmetros fixos:
- Tamanho: 1080×1920
- Efeitos: colorchannelmixer (0.7, 0.18, 0.15) + noise 18 + vignette
- Texto centralizado, cor `#f0ece0`, fontsize 38, Inter SemiBold
- Máx 860px de largura
- Sem branding, sem data, sem fonte
- Nome: `public/images/thumbs/[tema]-thumb.jpg`

### Regras Gerais
- **10 segmentos** × 4s = **40s** de vídeo
- Headline Forbes-style fixa (3 linhas, esquerda) — igual em TODOS os segmentos
- **NUNCA** repetir a primeira imagem nos outros segmentos
- **NUNCA** usar display text central
- Sem zoom/Ken Burns
- Sem fundo preto no rodapé
- Fonte Inter SemiBold em TUDO
- Áudio: **1 chamada Fish Audio** (nunca 1 por segmento)
- Blog + Reels sempre feitos juntos para a mesma notícia
- **Blog em INGLÊS** | Reel pode ser EN ou PT

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
