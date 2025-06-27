# Sistema de Anotações com Node.js

Um projeto full-stack de um aplicativo de anotações, construído com Node.js, Express e MySQL. A aplicação permite que usuários se cadastrem, criem, gerenciem e organizem suas anotações de forma segura e eficiente, com suporte a Markdown, etiquetas e muito mais.

## 📜 Sobre o Projeto

Este projeto foi desenvolvido como uma solução completa para gerenciamento de anotações pessoais. Ele vai além de um simples CRUD, implementando funcionalidades robustas como autenticação de usuários, sistema de lixeira (soft delete), organização por etiquetas, exportação de dados e gerenciamento de perfil. A aplicação foi estruturada seguindo as melhores práticas, com separação de responsabilidades entre rotas, controladores e views.

## ✨ Funcionalidades

-   [✔] **Autenticação de Usuários:** Cadastro, Login e Logout seguros com sessões e criptografia de senhas.
-   [✔] **CRUD Completo de Anotações:** Crie, visualize, edite e exclua suas anotações.
-   [✔] **Editor Markdown:** Crie anotações com formatação rica usando um editor Markdown (EasyMDE) com preview.
-   [✔] **Sistema de Etiquetas (Tags):** Organize suas anotações com múltiplas etiquetas personalizadas.
-   [✔] **Lixeira (Soft Delete):** Anotações excluídas são movidas para a lixeira, permitindo restaurá-las ou excluí-las permanentemente.
-   [✔] **Ações em Massa:** Exclua múltiplas anotações de uma só vez a partir do dashboard.
-   [✔] **Busca Dinâmica:** Filtre e encontre anotações instantaneamente no seu painel.
-   [✔] **Exportação de Dados:** Exporte todas as suas anotações para os formatos **.txt** e **.pdf**.
-   [✔] **Gerenciamento de Perfil:** Visualize, edite seu nome de usuário e exclua sua conta de forma segura.
-   [✔] **Design Responsivo:** Interface limpa e funcional, adaptada para diferentes tamanhos de tela.
-   [✔] **Segurança:** Rotas protegidas para garantir que cada usuário só acesse suas próprias informações.

## 🚀 Tecnologias Utilizadas

### Backend
-   **Node.js:** Ambiente de execução do JavaScript no servidor.
-   **Express.js:** Framework para criação do servidor e gerenciamento de rotas.
-   **MySQL2:** Driver para conexão com o banco de dados MySQL, com suporte a Promises.
-   **EJS:** Template engine para renderizar páginas HTML dinâmicas.
-   **Bcrypt:** Para criptografia e segurança de senhas (hashing).
-   **Express-Session:** Para gerenciamento de sessões de usuário (login).
-   **Joi:** Para validação de dados de entrada nos formulários.
-   **Dotenv:** Para gerenciamento de variáveis de ambiente.
-   **Showdown & DOMPurify:** Para converter Markdown em HTML e sanitizar a saída, prevenindo ataques XSS.
-   **PDFKit:** Para gerar arquivos PDF para exportação.

### Frontend
-   **HTML5 & CSS3:** Estruturação e estilização das páginas.
-   **JavaScript (Vanilla):** Para interatividade no lado do cliente (dropdowns, filtros, seleção em massa).
-   **EasyMDE:** Biblioteca para implementar o editor de texto Markdown.
-   **Font Awesome:** Para os ícones da interface.

### Banco de Dados
-   **MySQL:** Sistema de gerenciamento de banco de dados relacional.

## ⚙️ Como Executar o Projeto

Siga os passos abaixo para rodar a aplicação em seu ambiente local.

### Pré-requisitos
-   [Node.js](https://nodejs.org/) (versão 12 ou superior)
-   [MySQL](https://www.mysql.com/) (ou um servidor compatível como MariaDB)

### 1. Clonar o Repositório
```bash
git clone [https://github.com/TherryD/Treino_de_Rotas.git](https://github.com/TherryD/Treino_de_Rotas.git)
cd Treino_de_Rotas
```

### 2. Instalar as Dependências
```bash
npm install
```

### 3. Configurar o Banco de Dados
1.  Acesse o seu servidor MySQL.
2.  Crie um novo banco de dados. O nome padrão usado no projeto é `anotacoes_db`.
    ```sql
    CREATE DATABASE anotacoes_db;
    ```
3.  Execute os scripts SQL abaixo para criar as tabelas necessárias:

    ```sql
    -- Tabela de Usuários
    CREATE TABLE usuarios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      senha_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Tabela de Anotações
    CREATE TABLE anotacoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      nome VARCHAR(255) NOT NULL,
      descricao TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    -- Tabela de Etiquetas
    CREATE TABLE etiquetas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      nome VARCHAR(50) NOT NULL,
      UNIQUE KEY (user_id, nome),
      FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    -- Tabela de Associação (Muitos-para-Muitos)
    CREATE TABLE anotacao_etiqueta (
      note_id INT NOT NULL,
      tag_id INT NOT NULL,
      PRIMARY KEY (note_id, tag_id),
      FOREIGN KEY (note_id) REFERENCES anotacoes(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES etiquetas(id) ON DELETE CASCADE
    );
    ```

### 4. Configurar Variáveis de Ambiente
1.  Crie um arquivo chamado `.env` na raiz do projeto.
2.  Adicione as credenciais do seu banco de dados e um segredo para a sessão:
    ```env
    DB_HOST=localhost
    DB_USER=root
    DB_PASSWORD=sua_senha_aqui
    DB_DATABASE=anotacoes_db
    SESSION_SECRET='um-segredo-bem-longo-e-dificil-de-adivinhar-98765'
    ```

### 5. Iniciar a Aplicação
```bash
npm start
```

A aplicação estará disponível em `http://localhost:3000`.

## 🗺️ Rotas da Aplicação

A aplicação utiliza rotas bem definidas para cada funcionalidade:

* `GET /`: Página inicial.
* `GET /login`, `POST /login`: Login do usuário.
* `GET /cadastro`, `POST /cadastro`: Cadastro de novo usuário.
* `GET /logout`: Logout do usuário.
* `GET /:uid`: Dashboard do usuário.
* `GET /:uid/perfil`: Perfil do usuário.
* `POST /:uid/anotacoes/excluir-todos`: Exclusão em massa de anotações.
* `GET /:uid/:nid`: Visualizar uma anotação específica.
* `GET /:uid/:nid/editar`, `POST /:uid/:nid/editar`: Editar uma anotação.
* `GET /:uid/lixeira`: Acessar a lixeira.

## 📄 Licença
Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
