# Backend PisciAlerta

## Configuração local

1. Copie `.env.example` para `.env`.
2. Gere um segredo com pelo menos 32 bytes e defina-o em `JWT_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Instale e inicie a API:

```powershell
npm install
npm start
```

Para iniciar a API com telemetria simulada a cada 10 segundos:

```powershell
npm run simulate
```

O simulador também pode ser iniciado e interrompido pela interface do perfil proprietário. Não ative o simulador junto a sensores reais.

## Contas de demonstração

- Proprietário/admin: `admin@piscialerta.com` / `senha123`
- Operador: `operador@piscialerta.com` / `senha123`

Estas contas mockadas e senhas públicas servem apenas para demonstração; substitua-as por usuários persistidos e credenciais individuais antes de qualquer implantação real. Tokens JWT expiram em oito horas.

## Controle e simulador

Leituras de telemetria do ESP32 permanecem aceitas sem JWT para compatibilidade com o firmware atual. Consultas do dashboard e alterações exigem Bearer token. Cenários de simulação são restritos ao perfil admin; controle manual é permitido a admin e operador, mas só altera relés no modo simulado. Em modo de hardware, a API retorna `503` até existir um canal autenticado de comandos para o ESP32.

As leituras e comandos simulados são mantidos em memória e desaparecem ao reiniciar o processo.