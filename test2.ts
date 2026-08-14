const { image_search } = require('duckduckgo-images-api'); image_search({ query: 'TCL 43F35', moderate: true }).then(results => console.log(results[0]?.image)).catch(console.error);
