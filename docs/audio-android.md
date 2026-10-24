# Leitura em áudio no Android

A leitura usa o serviço de texto para voz do aparelho, em português. Não é
necessário permitir acesso ao microfone.

Toque em **Ouvir leitura** para começar. **Pausar leitura** interrompe a fala e
**Continuar leitura** repete o início do pequeno trecho atual. Essa retomada é
intencional: no Android, a pausa nativa da Web Speech API encerra a fala.

Se o link foi aberto dentro do WhatsApp e o áudio estiver indisponível, use
o menu **⋮ > Abrir no navegador** e escolha o Chrome. Alguns navegadores
internos usam Android WebView, que não oferece síntese de voz.

Se o Chrome também não reproduzir, confira o volume de mídia e se há um
serviço de texto para voz com português instalado nas configurações do Android.
O nome e a localização dessa configuração variam conforme o aparelho.

## Validação da correção

Execute `node --test tests/speech.test.cjs` com Node.js 18 ou superior.
Os testes simulam o sintetizador: verificam leituras longas, todos os dias
do plano, pausa/retomada, troca de leitura, eventos atrasados, vozes carregadas
depois do toque, falhas, bloqueio de reprodução e ausência da API.
Eles não substituem a verificação do som em um aparelho físico.

Para validar em Android:

1. Abra o site no Chrome e toque em **Ouvir leitura**.
2. Confira a passagem da reflexão para os textos bíblicos e entre capítulos.
3. Pause e continue; somente o pequeno trecho atual deve se repetir.
4. Troque a data durante a leitura; o áudio anterior deve parar.
5. Abra um link diário diretamente e repita a reprodução.
6. Abra pelo WhatsApp; se o navegador interno não oferecer áudio, confira
   a orientação para abrir no Chrome.

Referência de compatibilidade:
[MDN — SpeechSynthesis](https://github.com/mdn/browser-compat-data/blob/main/api/SpeechSynthesis.json).
