const google = require('googlethis'); google.image('TCL 43F35', { safe: false }).then(res => console.log(res[0]?.url)).catch(console.error);
