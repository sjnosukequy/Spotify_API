const express = require("express");
const app = express();
const ytdl = require("ytdl-core");
const cors = require("cors");
const puppeteer = require('puppeteer');
const { getAverageColor } = require('fast-average-color-node');
const axios = require('axios');
var bodyParser = require('body-parser');
const { Cheerio } = require("cheerio");

var urlencodedParser = bodyParser.urlencoded({ extended: true })
var jsonParser = bodyParser.json()

const corsOptions = {
  //   origin: "https://mplayer1.netlify.app",
  origin: "http://localhost:8001", //your frontend url here
  credentials: true, //access-control-allow-credentials:true
  optionSuccessStatus: 200,
  exposedHeaders: "**",
};

app.use(cors(corsOptions));

app.get("/download", async (req, res, next) => {
  // console.log(req.query.url);
  try {
    const videoUrl = req.query.url;
    const videoInfo = await ytdl.getInfo(videoUrl);
    const audioFormats = ytdl.filterFormats(videoInfo.formats, "audioonly");
    // console.log(audioFormats);
    const urls = audioFormats.map((item) => item.url);
    res.send(urls[0]);
  } catch (error) {
    next(error);
  }
});

app.get("/main", async (req, res) => {
  // console.log(req.query);
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Custom user agent
  const customUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36';

  await page.setViewport({ width: 1000, height: 890 });

  // Set custom user agent
  await page.setUserAgent(customUA);

  await page.goto('https://www.youtube.com/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ', { waitUntil: 'load' });

  await page.screenshot({ path: '1.png' });

  const data = await page.evaluate(() => {
    document.body.scrollIntoView(false);
    const reco_albums = document.querySelector("ytd-two-column-browse-results-renderer").querySelectorAll("#contents.style-scope.ytd-item-section-renderer");
    // const lists_album = reco_albums[2].querySelector("div").querySelector("ytmusic-carousel").querySelector("div").querySelector("ul").querySelectorAll("ytmusic-two-row-item-renderer");
    const urls = Array.from(reco_albums).map((Selection) => {
      return {
        name: Selection.querySelector('#title').innerHTML,
        child: Array.from(Selection.querySelector("#scroll-container").querySelector('#items').querySelectorAll("ytd-compact-station-renderer")).map(
          (Selection2) => {
            return {
              img: Selection2.querySelector('img').getAttribute("src"),
              link: Selection2.querySelector('a').getAttribute('href').split('&')[0],
              title: Selection2.querySelector('h3').innerHTML.trim(),
              info: Selection2.querySelector('p').innerHTML.trim()
            };
          })
      };
    });

    return urls;
  });

  await browser.close();
  res.send(data)
});

app.get("/playlist", async (req, res, next) => {
  try {

    // console.log(req.query);
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Custom user agent
    const customUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36';

    // Set custom user agent
    await page.setUserAgent(customUA);

    await page.setViewport({
      width: 960,
      height: 540
    });

    await page.goto(`https://www.youtube.com/${req.query.url}`, { waitUntil: 'load' });


    await page.screenshot({ path: '1.png' });


    const data = await page.evaluate(() => {
      const tracks = document.querySelector('#contents.style-scope.ytd-section-list-renderer').querySelector('#contents').querySelector('#contents').querySelectorAll('ytd-playlist-video-renderer');
      const urls = Array.from(tracks).map((Selection, index) => {
        Selection.scrollIntoView('false');
        const link_str = Selection.querySelector('a').getAttribute('href').split('&')[0];
        return {
          name: Selection.querySelector('h3').querySelector('a').innerHTML.trim(),
          link: link_str,
          image: `https://img.youtube.com/vi/${link_str.split('?v=')[1]}/sddefault.jpg`,
          // image: Selection.querySelector('a').querySelector('img').getAttribute('src'),
          artist: Selection.querySelector('#metadata').querySelector('a').innerHTML.trim()
        };
      });
      return urls;
    });

    await page.screenshot({ path: `0.png` });

    await browser.close();
    res.send(data)
  }
  catch (error) {
    data = `https://www.youtube.com/${req.query.url} Link does not exist`;
    next(error);
    // res.send(data)
  }

})

app.post("/getcolor", jsonParser, async (req, res, next) => {
  try {
    const response = await axios.get(
      req.body.url,
      { responseType: 'arraybuffer' }
    );
    const buffer = Buffer.from(response.data, 'binary');

    getAverageColor(buffer).then(color => {
      // console.log(color);
      res.send({ avg: color.hex })
    }).catch(error => {
      console.log(error)
      res.send({ avg: '#0000000' })
    });

  }
  catch (error) {
    next(error);
    // res.send(error)
  }
})

app.get("/getcolor", async (req, res, next) => {
  try {

    const response = await axios.get(
      req.query.url,
      { responseType: 'arraybuffer' }
    );
    const buffer = Buffer.from(response.data, 'utf-8');

    getAverageColor(buffer).then(color => {
      // console.log(color);
      res.send({ avg: color.hex })
    }).catch(error => {
      console.log(error)
      res.send({ avg: '#0000000' })
    });

  }
  catch (error) {
    next(error);
    res.send(error)
  }
})

app.get("/search", async (req, res, next) => {

  try {

    // console.log(req.query);
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Custom user agent
    const customUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36';

    // Set custom user agent
    await page.setUserAgent(customUA);

    await page.setViewport({
      width: 960,
      height: 540
    });

    await page.goto(`https://music.youtube.com/search?q=${req.query.url}`, { waitUntil: 'load' });

    await page.waitForSelector('ytmusic-responsive-list-item-renderer')

    await page.screenshot({ path: '1.png', fullPage: true });

    const data = await page.evaluate(() => {

      const lists_obj = document.querySelectorAll('ytmusic-shelf-renderer');
      let idx1 = 0;
      let idx2 = 0;

      for (let i = 0; i < Array.from(lists_obj).length; i++) {
        const name = lists_obj[i].querySelector('h2').querySelector('yt-formatted-string').innerHTML.trim();
        if (name == 'Songs')
          idx1 = i;
        else if (name == 'Community playlists')
          idx2 = i;
      }

      const songs = lists_obj[idx1].querySelectorAll('ytmusic-responsive-list-item-renderer')

      const song_urls = Array.from(songs).map((Selection, index) => {
        Selection.scrollIntoView('false');
        const link_str = Selection.querySelector('a').getAttribute('href');

        return {
          name: Selection.querySelector('a').innerHTML.trim(),
          link: `/${link_str}`,
          image: `https://img.youtube.com/vi/${link_str.split('?v=')[1]}/sddefault.jpg`,
          // image: Selection.querySelector('a').querySelector('img').getAttribute('src'),
          artist: Selection.querySelectorAll('yt-formatted-string')[1].querySelector('a').innerHTML.trim()
        };
      });

      const albums = lists_obj[idx2].querySelectorAll('ytmusic-responsive-list-item-renderer')
      const album_urls = Array.from(albums).map((Selection, index) => {
        Selection.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
        const link_str = Selection.querySelectorAll('a')[0].getAttribute('href');
        let img = Selection.querySelector('img').getAttribute('src');
        if (img.includes("data:"))
          img = null
        return {
          title: Selection.querySelectorAll('a')[0].getAttribute('aria-label').trim(),
          link: `/${link_str}`,
          img: img,
          // image: Selection.querySelector('a').querySelector('img').getAttribute('src'),
          info: Selection.querySelectorAll('a')[1].innerHTML.trim()
        };
      });


      urls = {
        'songs': song_urls,
        'albums': album_urls
      }

      return urls;
    });

    await page.screenshot({ path: `0.png` });

    let length = data['albums'].length

    for (let i = 0; i < length; i++) {
      await page.goto(`https://music.youtube.com${data['albums'][i].link}`, { waitUntil: 'load' })
      await page.screenshot({ path: `${i + 3}.png` })
      const url = await page.url();
      data['albums'][i].link = url.split('.com/')[1]
    }

    await browser.close();

    // data['albums'].map(async (item, index) => {
    //   // await axios.get(`https://music.youtube.com${item.link}`, { headers: { 'User-Agent': customUA } }).then((response) => { console.log(response); })
    //   await
    // })

    res.send(data)
  }
  catch (error) {
    next(error);
    // res.send(error)
  }

})

app.listen(3000, () => {
  console.log("Server running on port 3000");
});