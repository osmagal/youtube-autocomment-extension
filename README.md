# YouTube Auto Commenter Chrome Extension

Uma extensão para Google Chrome (Manifest V3) que funciona no modo **Side Panel**, permitindo adicionar automaticamente um comentário configurável em vídeos do YouTube ao acessá-los, com controle automático para evitar comentários duplicados.

## 🚀 Funcionalidades

- **Modo Side Panel**: Interface moderna com tema escuro acessível na barra lateral do navegador.
- **Prevenção de Duplicados**: Registra o ID de cada vídeo comentado no `chrome.storage.local` para nunca publicar mais de uma vez no mesmo vídeo.
- **Automação no YouTube**: Detecta a página do vídeo, faz a rolagem necessária para carregar os comentários, preenche o campo do editor e realiza o envio.
- **Histórico Completo**: Visualização e busca de todos os vídeos que já foram comentados com opção de remoção individual ou limpeza total do histórico.
- **Envio Automático ou Manual**: Opção de enviar automaticamente ou apenas preencher o campo para revisão.

## 📦 Como Instalar

1. Clone este repositório ou faça o download dos arquivos:
   ```bash
   git clone git@github.com:osmagal/youtube-autocomment-extension.git
   ```
2. Abra o Google Chrome e acesse `chrome.google.com` ou `chrome://extensions`.
3. Ative o **Modo do desenvolvedor** (Developer mode) no canto superior direito.
4. Clique em **Carregar sem compactação** (*Load unpacked*).
5. Selecione a pasta deste projeto.

## 🛠️ Tecnologias Utilizadas

- **Manifest V3**
- **Chrome Side Panel API**
- **Chrome Storage API**
- **HTML5 / CSS3 Vanilla (YouTube Dark Theme)**
- **JavaScript ES6+**

## 📄 Licença

Este projeto está sob a licença MIT.
