# Faroeste Survivors 2D

Versão isométrica em pixel art 32 bits do Faroeste Survivors. A primeira fase, **Deserto dos Esquecidos**, usa as regras do jogo de referência e tem arte 2D própria.

## Jogar

Use Node.js 22.12 ou mais recente e um navegador com WebGL 2.

```sh
npm ci
npm run dev
```

- **Andar** com WASD, setas ou toque e arraste no campo de batalha.
- **Atacar** é automático. João usa o laço e os outros campeões usam suas armas próprias.
- **Pausar** com Esc ou o botão no canto superior direito.
- **Coletar** experiência, moedas, suprimentos e bandagens passando perto dos itens. O indicador no HUD aponta para caixas, Bento e o Escorpião do Ouro.

Na seleção de fase, abra **Arsenal**, **Loja do Bento** ou **Bestiário** para preparar a partida. O Arsenal é liberado ao terminar a primeira partida.

Em celulares e tablets compatíveis, o primeiro toque em **Novo jogo** solicita tela cheia. No iPhone ou iPad, use **Adicionar à Tela de Início** no Safari e abra pelo ícone para jogar sem a barra do navegador. O jogo se ajusta em retrato e paisagem. A opção **Resolução do jogo** permite começar com mais nitidez e continua se ajustando à carga da partida.

No modo História, conclua as três missões e vença o Patriarca da Noite, o Chupacabra de Brasas e o Xerife das Sombras durante os 15 minutos de sobrevivência. O relógio congela enquanto houver um chefe na arena ou uma escolha pendente. Completar a fase libera o modo Livre. As moedas e descobertas são registradas ao terminar uma partida e o perfil 2D fica salvo no navegador.

## Código

| Pasta | Responsabilidade |
| --- | --- |
| `src/config` | Campeões, cartas, missões, chefes e regras de progressão |
| `src/models` e `src/systems` | Estado da partida e simulação reaproveitada da versão original |
| `src/viewmodels` | Navegação, ações da partida e progresso |
| `src/views` | Menu e HUD em HTML, câmera ortográfica, cenário e sprites 2D no Three.js |
| `src/services` | Controles, áudio, persistência e textos |

`npm test` verifica regressões da fase. `npm run build` gera a versão estática em `dist`. `npm run preview` serve a build localmente.

## Publicação no GitHub Pages

No GitHub, selecione **GitHub Actions** em **Settings → Pages → Source**. O workflow [deploy-pages.yml](.github/workflows/deploy-pages.yml) instala as dependências, roda os testes, compila o jogo e publica `dist` a cada push na `main`. Também pode ser executado manualmente pela aba **Actions** na `main`. O Vite gera URLs relativas para servir os arquivos na subpasta do repositório.

Os materiais visuais do jogo estão em `src/assets`. Consulte [ART.md](ART.md) para os prompts da arte gerada e os recursos reaproveitados.
