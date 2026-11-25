# Calculadora Perfecta Print — resumo

**Atualizado:** 06/11/2026

## Concluído

- Acesso por usuário e senha, sem cadastro público.
- Conta master provisionada; somente ela pode listar, criar, editar, bloquear e reativar contas, além de redefinir senhas.
- Senhas protegidas com hash; sessões armazenadas no banco e cookies protegidos.
- Limites de tentativas de login reforçados contra contornos por troca de usuário ou IP.
- Eventos de login e criação de contas pelo master adicionados às métricas.
- Nome “Calculadora Perfecta Print” aplicado ao título do app, tela de entrada, metadados e artefato.
- Alterações de banco aditivas, preservando dados e estruturas anteriores.

## Verificações

- Typecheck do workspace passou após as alterações de nome.
- API iniciou e provisionou a conta master; `/api/healthz` respondeu `200`.
- Rotas privadas de autenticação e gerenciamento responderam `401` sem sessão, como esperado.
- A tela de entrada foi conferida na prévia.

## Publicação e domínio

- Publicação atual: `https://calculadora-de-etiquetas--jonathasthiago.replit.app` (pública, verificada em 06/11/2026).
- O domínio `calculadora.perfectaprint.com.br` ainda não consta conectado à publicação. O CNAME informado precisa apontar para o destino mostrado em **Publishing → Domains**, e o registro TXT de verificação do Replit deve ser mantido.
- Conectar o domínio personalizado não exige despublicar. O endereço `.replit.app` continuará ativo como alternativa.

## Em andamento

- Reforço do limite de tentativas na troca de senha.
