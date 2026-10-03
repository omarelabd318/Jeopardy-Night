# Building Jeopardy Night

Don't edit index.html by hand. It's generated. Edit the sources, then rebuild from this folder:

    node build.js            # writes index.html
    node mkpacks.js          # only when Guess the Food photos change; writes photos/food-100.js … food-500.js (needs ImageMagick `convert`)
    node mkpacks.js logo     # only when Guess the Logo images change; writes photos/logo-100.js … logo-500.js
    python3 v4work/logo-fetch.py   # downloads missing logos from Wikipedia into v4work/logo-photos/ (list: v4work/logo-photos.json)

- **src/head.html:** the CSS and page shell. Football mode colours are in the `body.football` rules near the top.
- **src/app.js:** the game logic. It includes the setup groups (`CAT_GROUPS`) and the Football mode pool (`FOOTBALL`).
- **src/builtin.js and src/base.json:** the original categories and clues.
- **src/extra.js:** adds the v4 categories, such as Who Am I?, Stadiums, Formations and Guess the Food.
- **v4work/out/<id>.json:** each file replaces that category's clues at build time.
- **Photo clues:** a photo clue is used only when its `photos/<key>.jpg` exists in this folder.
- **Version number:** the label is the `v4.NN` string in src/head.html and src/app.js. Bump it with `sed -i 's/v4\.NN/v4.MM/g' src/head.html src/app.js`.
- **Publishing:** the live artifact serves index.html plus photos/ and sounds/. It holds at most 511 files, which is why the food photos ship as five .js bundles.
