const https = require('https');
https.get('https://master.boss-os-269.pages.dev/', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTML Length:', data.length);
    const scriptMatch = data.match(/<script.*?src=\"(.*?)\".*?><\/script>/);
    if(scriptMatch) {
      console.log('Found script:', scriptMatch[1]);
      https.get('https://master.boss-os-269.pages.dev' + scriptMatch[1], (res2) => {
        console.log('Script status:', res2.statusCode);
      });
    } else {
      console.log('No script found. HTML:', data.substring(0, 500));
    }
  });
});
