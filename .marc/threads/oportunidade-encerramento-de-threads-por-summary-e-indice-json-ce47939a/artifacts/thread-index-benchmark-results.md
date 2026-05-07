# Thread Index Benchmark Results

Command:

```bash
pnpm dlx tsx "./performance/thread-index.benchmark.mjs"
```

```text
volume: 100
scenario               ms  vs direct  vs volume 100
-----------------  ------  ---------  -------------
scan direct         64.27       base           base
json cold rebuild   56.71     -11.8%           base
json warm list      28.34     -55.9%           base
json rebuild 10x   448.61    +598.0%           base

volume: 500
scenario                ms  vs direct  vs volume 100
-----------------  -------  ---------  -------------
scan direct         204.36       base        +218.0%
json cold rebuild   174.14     -14.8%        +207.1%
json warm list       25.93     -87.3%          -8.5%
json rebuild 10x   2953.11   +1345.1%        +558.3%

volume: 1000
scenario                ms  vs direct  vs volume 100
-----------------  -------  ---------  -------------
scan direct         410.76       base        +539.1%
json cold rebuild   494.93     +20.5%        +772.8%
json warm list       30.93     -92.5%          +9.1%
json rebuild 10x   4571.77   +1013.0%        +919.1%

volume: 5000
scenario                 ms  vs direct  vs volume 100
-----------------  --------  ---------  -------------
scan direct         2057.09       base       +3100.8%
json cold rebuild   2075.56      +0.9%       +3560.1%
json warm list        28.97     -98.6%          +2.2%
json rebuild 10x   23898.26   +1061.8%       +5227.2%

volume: 10000
scenario                 ms  vs direct  vs volume 100
-----------------  --------  ---------  -------------
scan direct         2858.84       base       +4348.3%
json cold rebuild   2828.54      -1.1%       +4887.9%
json warm list        31.47     -98.9%         +11.1%
json rebuild 10x   23899.15    +736.0%       +5227.4%
```

## Observações

- Warm list ficou estável perto de 26-31 ms mesmo em 10k threads.
- Cold rebuild e scan direto ficaram próximos em volumes altos.
- Rebuild 10x chegou a aproximadamente 24 segundos em 5k/10k threads.
- Rebuild pesado pode rodar em background e atualizar a interface quando terminar.
- Uma tool/status de saúde por módulo no MCP pode ajudar agentes a saberem se algum índice/rebuild está em andamento.
