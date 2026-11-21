# Faroeste Survivors 2D

Versão isométrica em pixel art de 32 bits do Faroeste Survivors, com as fases **Deserto dos Esquecidos** e **Mina da Noite**.

## Jogar

Use Node.js 22.12 ou mais recente e um navegador com WebGL 2.

```sh
npm ci
npm run dev
```

- **Andar** com WASD, setas ou toque e arraste no campo de batalha.
- **Atacar** é automático. João usa o chicote e os outros campeões usam suas armas próprias. Disparo Duplicado acrescenta ataques sequenciais em outras direções ao chicote, aos disparos e aos arremessos.
- **Pausar** com Esc ou o botão no canto superior direito.
- **Coletar** experiência, moedas, suprimentos e bandagens passando perto dos itens. O indicador no HUD aponta para caixas, Bento e a criatura de tesouro da fase.

Na seleção de fase, abra **Arsenal**, **Loja do Bento** ou **Bestiário** para preparar a partida. O Arsenal é liberado ao terminar a primeira partida.

Em celulares e tablets compatíveis, o primeiro toque em **Novo jogo** solicita tela cheia. No iPhone ou iPad, use **Adicionar à Tela de Início** no Safari e abra pelo ícone para jogar sem a barra do navegador. O jogo se ajusta em retrato e paisagem. A opção **Resolução do jogo** permite começar com mais nitidez e continua se ajustando à carga da partida.

Cada fase tem 15 minutos de sobrevivência, com ondas que se intensificam conforme o relógio avança. No modo História, conclua três missões e derrote três chefes na mesma partida. Vencer o Deserto libera a Mina e o Modo Livre. Vencer a Mina libera Elias Ferro, Ruth Faísca e Neco Pavio. O relógio congela durante confrontos com chefes e escolhas de cartas. O progresso fica salvo no navegador.

## Código

| Pasta | Responsabilidade |
| --- | --- |
| `src/config` | Campeões, cartas, missões, chefes e regras de progressão |
| `src/models` e `src/systems` | Estado da partida e simulação reaproveitada da versão original |
| `src/viewmodels` | Navegação, ações da partida e progresso |
| `src/views` | Menu e HUD em HTML, câmera ortográfica, cenário e sprites 2D no Three.js |
| `src/services` | Controles, áudio, persistência e textos |

`npm test` verifica regressões de combate, progressão e renderização. `npm run build` gera a versão estática em `dist`. `npm run preview` serve a build localmente.

## Publicação no GitHub Pages

No GitHub, selecione **GitHub Actions** em **Settings → Pages → Source**. O workflow [deploy-pages.yml](.github/workflows/deploy-pages.yml) instala as dependências, roda os testes, compila o jogo e publica `dist` a cada push na `main`. Também pode ser executado manualmente pela aba **Actions** na `main`. O Vite gera URLs relativas para servir os arquivos na subpasta do repositório.

Os materiais visuais do jogo estão em `src/assets`. Consulte [ART.md](ART.md) para os prompts da arte gerada e os recursos reaproveitados.
