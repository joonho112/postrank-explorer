# postrank Explorer v3.5

postrank Explorer shows how uncertainty affects rankings and grade reports through 84 interactive apps. Version 3.5 adds five apps on multidomain profiles, which give each unit a separate grade in each domain.

[Open postrank Explorer](https://joonho112.github.io/postrank-explorer/)

**Author** JoonHo Lee ([jlee296@ua.edu](mailto:jlee296@ua.edu)), The University of Alabama.

## Run locally

The built site is in `docs/`. From the repository root, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory docs
```

Open [the local site](http://127.0.0.1:8000/).

## Build from source

Use Node.js 25.8.1 or later, npm, and Quarto.

```sh
npm ci --prefix engine
npm ci --prefix tools
npm run build --prefix engine
quarto render
```

The numerical reference is postrank 1.2.0. See the [engine guide](engine/README.md) and [R reproduction guide](r-export/v35/README.md).

## Citation and licenses

[Citation information](CITATION.cff) · [MIT code license](LICENSE) · [CC BY 4.0 text and figure license](LICENSE-DATA) · [Source-specific data terms](notes/data-rights.md)

Research support came from the National Academy of Education and Spencer Foundation through the 2025 NAEd/Spencer Postdoctoral Fellowship, and from the Institute of Education Sciences, U.S. Department of Education, through Grant R305D240078 to The University of Alabama.
