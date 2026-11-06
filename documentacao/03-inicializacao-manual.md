# Inicialização manual no Windows

O Docker Desktop foi removido das entradas de inicialização do usuário. O serviço Windows WSLService foi alterado de Automático para Manual. O objetivo é deixar o ambiente de desenvolvimento parado até ser usado.

Para retomar o desenvolvimento, abra o Docker Desktop e o Ubuntu, entre em ~/projetos/vtt-platform e execute docker compose up -d --wait e pnpm dev. O primeiro comando inicia o banco. O segundo inicia a API e o frontend.

A alteração foi confirmada na configuração do Windows. O comportamento após a próxima reinicialização ainda não foi testado.
