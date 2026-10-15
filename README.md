# U-Go

Aplicativo de transporte universitário em React, Vite, Tailwind CSS e Supabase.

## Arquitetura de componentes

Os contratos fornecidos e requeridos por `ComponenteUsuario` e `ComponenteContratos`, incluindo
pré-condições, pós-condições e falhas das operações, estão documentados em
[`docs/component-contracts.md`](docs/component-contracts.md).

A configuração de confirmação de e-mail, redirects, template e SMTP do Supabase está em
[`docs/supabase-email-validation.md`](docs/supabase-email-validation.md).

O modelo, a migration e as políticas RLS que isolam rotas por motorista estão em
[`docs/supabase-driver-routes.md`](docs/supabase-driver-routes.md).

## Integração de mapas e rotas

O U-Go usa OpenStreetMap e serviços do ecossistema aberto para exibir e calcular rotas. A integração não
precisa de chave de API, variável de ambiente, cartão ou conta de faturamento.

### Tecnologias

| Serviço | Responsabilidade |
| --- | --- |
| [Leaflet](https://leafletjs.com/) | Renderização e interação com o mapa |
| [React Leaflet](https://react-leaflet.js.org/) | Componentes React para o Leaflet |
| [OpenStreetMap](https://www.openstreetmap.org/) | Tiles e dados cartográficos |
| [Photon](https://photon.komoot.io/) | Busca e geocodificação reversa sobre dados OSM |
| [OSRM](https://project-osrm.org/) | Cálculo do trajeto de carro entre as coordenadas |

Dependências utilizadas:

```text
leaflet
react-leaflet
@types/leaflet
```

O CSS oficial do Leaflet é importado em `src/index.css`.

### Arquivos principais

- `src/components/RouteMap.tsx`: geocodifica os endereços, calcula a rota e renderiza o mapa;
- `src/components/RouteMapModal.tsx`: apresenta o mapa sobre os dashboards e garante uma área visível;
- `src/index.css`: carrega os estilos necessários do Leaflet;
- `src/pages/*/*Dashboard.tsx`: abre o modal pelo botão **Ver no mapa**.

O mesmo modal é reutilizado pelos dashboards de universitário, motorista, empresa e colaborador.

### Cadastro de pontos de embarque pelo motorista

No formulário **Nova rota** ou **Editar rota**, o motorista pode:

1. buscar uma rua, praça ou referência pelo Photon;
2. clicar diretamente no mapa para fazer geocodificação reversa;
3. adicionar um pin com nome e endereço;
4. editar o nome apresentado sobre o pin;
5. reordenar os pontos conforme a sequência de embarque;
6. remover pontos antes de salvar;
7. salvar os pontos junto com os demais dados da rota.

Cada ponto salvo contém `id`, `name`, `address`, `lat` e `lng`. A rota exige ao menos um ponto de
embarque e todos os pins precisam ter nome. Os pontos aparecem:

- na lista da rota no dashboard do motorista;
- como pins numerados e nomeados no mapa;
- como paradas intermediárias, na ordem definida, no cálculo do OSRM.

O editor está em `src/components/PickupPointEditor.tsx`. As funções compartilhadas de busca,
geocodificação reversa e cálculo de rota estão em `src/lib/openStreetMap.ts`.

### Fluxo da integração

1. O usuário autenticado clica em **Ver no mapa**.
2. O dashboard salva a rota selecionada em `mapRoute` e monta `RouteMapModal`.
3. O modal repassa `origin` e `destination` para `RouteMap`.
4. O Photon geocodifica primeiro a origem e depois o destino.
5. O componente serializa as consultas com intervalo de 1,1 segundo para evitar abuso do serviço público.
6. O OSRM recebe as duas coordenadas e devolve a geometria GeoJSON do trajeto de carro.
7. O Leaflet desenha:
   - os tiles do OpenStreetMap;
   - um marcador roxo na origem;
   - um marcador fúcsia no destino;
   - uma linha roxa representando o trajeto.
8. O mapa ajusta automaticamente o enquadramento com `fitBounds`.

O modal possui altura explícita e `RouteMap` usa `ResizeObserver` com `map.invalidateSize()`. Isso evita
que o Leaflet seja inicializado com altura zero quando o mapa aparece dentro do modal.

### Endpoints

#### Geocodificação

```http
GET https://photon.komoot.io/api/
    ?q={endereco}
    &limit=1
    &bbox=-73.99,-33.75,-34.79,5.27
```

O `bbox` prioriza resultados dentro do território brasileiro. A primeira feature GeoJSON fornece
longitude e latitude. Para cliques no mapa, a geocodificação reversa usa `/reverse?lat={lat}&lon={lon}`.

#### Cálculo da rota

```http
GET https://router.project-osrm.org/route/v1/driving/{origemLng},{origemLat};{destinoLng},{destinoLat}
    ?overview=full
    &geometries=geojson
```

O perfil `driving` calcula uma rota rodoviária. As coordenadas GeoJSON retornadas pelo OSRM seguem a
ordem `[longitude, latitude]`; o componente converte cada posição para `[latitude, longitude]`, formato
esperado pelo Leaflet.

#### Tiles

```text
https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

A atribuição ao OpenStreetMap permanece visível no mapa, conforme exigido pela política do serviço.

### Estados e tratamento de erros

O componente trabalha com três estados:

- `loading`: exibe “Calculando rota...”;
- `ok`: mostra o mapa e o trajeto;
- `error`: apresenta uma mensagem e o botão **Tentar novamente**.

Erros tratados:

- endereço sem resultado no Photon;
- rota sem resultado no OSRM;
- resposta HTTP malsucedida;
- limite temporário HTTP `429`;
- falha inesperada durante o carregamento.

Ao desmontar ou trocar a rota, o efeito é cancelado para evitar atualização de estado depois que o modal
for fechado.

### Serviços públicos e limites

Os endpoints públicos usados pelo projeto não cobram por requisição, mas são serviços comunitários com
políticas de uso, limites e sem garantia de disponibilidade. Eles são adequados para desenvolvimento,
demonstrações e baixo volume.

Para evitar bloqueios:

- não faça geocodificação automática a cada tecla digitada;
- abra o mapa somente quando o usuário solicitar;
- evite consultas repetidas para os mesmos endereços;
- mantenha a atribuição do OpenStreetMap visível;
- não faça downloads em massa nem pré-carregamento de tiles;
- trate respostas HTTP `429` aguardando antes de tentar novamente.

As consultas partem diretamente do navegador. Portanto, os endereços de origem e destino são enviados
ao Photon e as coordenadas são enviadas ao OSRM. Não envie dados pessoais desnecessários nos campos
de endereço.

Consulte as políticas oficiais:

- [OpenStreetMap Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
- [Photon](https://github.com/komoot/photon)
- [OSRM demo server](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server)

### Produção em maior escala

Não há cobrança automática no código atual. Porém, se o volume crescer, os servidores públicos podem
limitar ou bloquear o tráfego. Para continuar sem custo por requisição e ter controle de capacidade, a
alternativa é hospedar instâncias próprias de Photon, OSRM e tiles — ainda haverá custo de
infraestrutura do servidor.

Antes de usar os endpoints públicos em produção com tráfego relevante, considere:

- cachear resultados de geocodificação;
- usar um proxy/backend com controle de taxa;
- monitorar respostas `429` e indisponibilidade;
- contratar um provedor compatível com OSM ou hospedar os serviços;
- configurar URLs dos serviços por ambiente.

### Validação

1. Entre com um usuário autenticado.
2. Clique em **Ver no mapa** em uma rota.
3. Confirme que o modal ocupa uma área visível e os tiles são carregados.
4. Aguarde a geocodificação de origem e destino.
5. Confirme que os dois marcadores aparecem e o trajeto roxo é desenhado.
6. Redimensione a janela e confirme que o mapa acompanha o modal.
7. Teste um endereço inexistente e confira a mensagem de erro.
8. Em caso de indisponibilidade ou limite temporário, use **Tentar novamente** após aguardar.

### Diagnóstico

Se o modal aparecer sem mapa:

1. confirme no DevTools que o contêiner `.leaflet-container` possui altura e largura maiores que zero;
2. verifique na aba **Network** as requisições para `tile.openstreetmap.org`;
3. confirme que o CSS `leaflet/dist/leaflet.css` foi carregado;
4. verifique bloqueios de rede, CORS ou Content Security Policy;
5. confira as respostas do Photon e do OSRM;
6. aguarde antes de repetir a operação caso algum serviço responda HTTP `429`.
