const express = require("express");
const app = express();
const ytdl = require("ytdl-core");
const cors = require("cors");
const puppeteer = require('puppeteer');
const { getAverageColor } = require('fast-average-color-node');
const axios = require('axios');
var bodyParser = require('body-parser');
const { sql } = require("./sql/db");
const { model, generationConfig, safetySettings } = require("./Gemini/Gemini")


var urlencodedParser = bodyParser.urlencoded({ extended: true })
var jsonParser = bodyParser.json()

const corsOptions = {
  //   origin: "https://mplayer1.netlify.app",
  // origin: "http://localhost:8081", //your frontend url here
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
    const audioFormats = ytdl.filterFormats(videoInfo.formats, "audioonly").filter(item => item.container == 'mp4');
    // console.log(audioFormats);
    // const urls = audioFormats.map((item) => item.url);
    res.send(audioFormats[0].url);
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

    await page.waitForSelector('ytmusic-shelf-renderer', { visible: true })

    await page.screenshot({ path: '1.png', fullPage: true });

    let data = await page.evaluate(async () => {

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
          name: Selection.querySelector('a').innerHTML?.trim() || 'Failed to load',
          link: `/${link_str}`,
          image: `https://img.youtube.com/vi/${link_str.split('?v=')[1]}/sddefault.jpg`,
          // image: Selection.querySelector('a').querySelector('img').getAttribute('src'),
          artist: Selection.querySelectorAll('yt-formatted-string')[1].querySelector('a').innerHTML?.trim() || 'Failed to load'
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
          info: Selection.querySelectorAll('a')[1].innerHTML?.trim() || 'Failed to load'
        };
      });

      urls = {
        'songs': song_urls,
        'albums': album_urls,
      }

      return urls;
    });

    const se = `%${req.query.url}%`
    const album2 = await sql`select a.title, a.image as img, a.info, a.id from album a where a.title ilike ${se}`
    const song2 = await sql`select t.title as name, t.link , t.image, u.username as artist  from track t inner join users u on t.userid = u.id where t.title ilike ${se}`

    data['album2'] = album2
    data['song2'] = song2

    // await page.screenshot({ path: `0.png` });

    // let length = data['albums'].length

    // for (let i = 0; i < length; i++) {
    //   await page.goto(`https://music.youtube.com${data['albums'][i].link}`, { waitUntil: 'load' })
    //   await page.screenshot({ path: `${i + 3}.png` })
    //   const url = await page.url();
    //   data['albums'][i].link = url.split('.com/')[1]
    // }

    await browser.close();

    res.send(data)
  }
  catch (error) {
    next(error);
    // res.send(error)
  }

})


//SQL PATH

/**
 * @param {key, username, password  }
 * @return {user}
 */
app.post("/getUser", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = null
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const string = `select * from users where username = '${req.body.username}' or email = '${req.body.username}' and password = '${req.body.password}' `
      const user = await sql`select * from users where (username = ${req.body.username} or email = ${req.body.username}) and password = ${req.body.password} `
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {key, username, password  }
 * @return {user}
 */
app.post("/getAdmin", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = [{}]
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const user = await sql`select u.*, 'admin' as role from users u inner join "admin" a on u.id = a.id where (u.username=${req.body.username} or u.email=${req.body.username}) and u."password" =${req.body.password}`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {key, username, password  }
 * @return {user}
 */
app.post("/getArtist", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = [{}]
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const user = await sql`select u.*, 'artist' as role from users u inner join "artist" a on u.id = a.id where (u.username=${req.body.username} or u.email=${req.body.username}) and u."password" =${req.body.password}`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {key, username, password }
 * @return {user}
 */
app.post("/upArtist", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = [{}]
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const user = await sql`SELECT * FROM insert_artist(${req.body.username}, ${req.body.password});`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {key}
 * @return {user}
 */
app.post("/getUsers", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = null
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const user = await sql`select u.* from users u left join "admin" a on u.id = a.id where a.id is null`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {key, username, password, emal, nickname}
 * @return {user}
 */
app.post("/addUser", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = null
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const user = await sql`select * from users where (username = ${req.body.username} or email = ${req.body.email})`
      if (user.length != 0)
        data = 'Already exist user'
      else {
        const newuser = {
          'username': req.body.username,
          'email': req.body.email,
          'nickname': req.body.nickname,
          'password': req.body.password,
          'ban': false
        }
        data = await sql` insert into users ${sql(newuser, 'username', 'email', 'nickname', 'password', 'ban')} returning id,username,email,nickname,password,ban`
      }
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})


/**
 * @param {key, ids:[[3], [5]]}
 * @return {user}
 */
app.post("/banUser", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = null
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      data = await sql`
      update users set ban = true
      from (values ${sql(response.ids)}) as update_data(id)
      where users.id = update_data.id
      returning users.id, users.username, users.email, users.ban`
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})


/**
 * @param {key, username, password, emal, nickname, id}
 * @return {user}
 */
app.post("/updateUser", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = null
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const newuser = {
        'id': req.body.id,
        'username': req.body.username,
        'email': req.body.email,
        'nickname': req.body.nickname,
        'password': req.body.password
      }
      data = await sql`
      update users set ${sql(newuser, 'username', 'email', 'nickname', 'password')}
      where users.id = ${newuser.id}
      returning users.*`
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})


/**
 * @param {key, ids:[[3], [5]]}
 * @return {user}
 */
app.post("/unbanUser", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = null
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      data = await sql`
      update users set ban = false
      from (values ${sql(response.ids)}) as update_data(id)
      where users.id = update_data.id
      returning users.id, users.username, users.email, users.ban`
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {key, username }
 * @return {user}
 */
app.post("/getArtistAlbums", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = {}
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const user = await sql`select a.*, u2.username  from album a inner join artist u on a.userid = u.id inner join users u2 on u.id = u2.id where u2.username = ${req.body.username}`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {key, id }
 * @return {user}
 */
app.post("/getArtistAlbum", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = {}
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const user = await sql`select * from album a where a.id = ${req.body.id}`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {key, title, userid, imagem info, id }
 * @return {user}
 */
app.post("/updateArtistAlbum", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = {}
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const user = await sql`update album
      set title =${req.body.title}, userid = ${req.body.userid}, image =${req.body.image}, info = ${req.body.info}
      where id = ${req.body.id}
      returning album.*`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {key, id }
 * @return {user}
 */
app.post("/delArtistAlbum", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = {}
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      await sql`DELETE FROM track 
      WHERE albumid = ${req.body.id}`
      const user = await sql`delete from album 
      where id = ${req.body.id} returning album.*`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {key, title, userid, image, info }
 * @return {user}
 */
app.post("/addArtistAlbum", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = {}
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {

      const newtrack = {
        'title': req.body.title,
        'userid': req.body.userid,
        'image': req.body.image,
        'info': req.body.info
      }
      // console.log(newtrack)
      const user = await sql` insert into album ${sql(newtrack, 'title', 'userid', 'image', 'info')} returning album.*`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})


/**
 * @param {key, username }
 * @return {user}
 */
app.post("/getArtistsongs", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = {}
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const user = await sql`select a.*, u2.username,a2.title as album_title from track a inner join artist u on a.userid = u.id 
      inner join users u2 on u.id = u2.id
      inner join album a2 on a.albumid = a2.id 
      where u2.username = ${req.body.username}`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {key, id }
 * @return {user}
 */
app.post("/getArtistsong", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = {}
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const user = await sql`select * from track t where t.id = ${req.body.id}`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {key, title, albumid, image, id }
 * @return {user}
 */
app.post("/updateArtistsong", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = {}
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const user = await sql`update track 
      set title = ${req.body.title}, albumid = ${req.body.albumid}, image = ${req.body.image}
      where track.id = ${req.body.id} returning track.*`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {key, id }
 * @return {user}
 */
app.post("/delArtistsong", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = {}
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const user = await sql`delete from track 
      where id = ${req.body.id} returning track.*`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {key, title, userid, albumid, image, link }
 * @return {user}
 */
app.post("/addArtistsong", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = {}
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // const newuser = {
      //   'username': req.body.username,
      //   'email': req.body.email,
      //   'nickname': req.body.nickname,
      //   'password': req.body.password,
      //   'ban': false
      // }
      // data = await sql` insert into users ${sql(newuser, 'username', 'email', 'nickname', 'password', 'ban')} returning id,username,email,nickname,password,ban`

      const newtrack = {
        'title': req.body.title,
        'userid': req.body.userid,
        'albumid': req.body.albumid,
        'image': req.body.image,
        'link': req.body.link
      }
      const user = await sql` insert into track ${sql(newtrack, 'title', 'userid', 'albumid', 'image', 'link')} returning track.*`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {url:albumid }
 * @return {album}
 */
app.get("/getAlbumSong", async (req, res, next) => {
  try {
    let data = []
    const user = await sql`select t.title as name, t.link , t.image, u.username as artist  
    from track t inner join users u on t.userid = u.id
    where t.albumid = ${req.query.url}`
    if (user.length != 0)
      data = user
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send(error)
  }
})

/**
 * @param {url:userid }
 * @return {playlist id}
 */
app.get("/getUserPlaylists", async (req, res, next) => {
  try {
    let data = []
    const user = await sql`select id from playlist p where p.userid = ${req.query.url}`
    if (user.length != 0)
      data = user
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send(error)
  }
})

/**
 * @param {url:playlistid }
 * @return {songs}
 */
app.get("/getPlaylistSongs", async (req, res, next) => {
  try {
    let data = []
    const user = await sql`select * from playlistdetails p where p.playlistid = ${req.query.url}`
    if (user.length != 0)
      data = user
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send(error)
  }
})

/**
 * @param {key, title, userid, image, info }
 * @return {user}
 */
app.post("/addPlaylist", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = {}
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {

      const newtrack = {
        'userid': req.body.userid,
        'title': req.body.title,
        'image': req.body.image,
        'info': req.body.info
      }
      const user = await sql`insert into playlist ${sql(newtrack, 'title', 'userid', 'image', 'info')} returning playlist.*`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {key, playlistid, name, link, image, artist }
 * @return {user}
 */
app.post("/addPlaylistTrack", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = {}
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      await axios.get(req.body.link, {
        responseType: 'stream'
      }).then((res) => {
        console.log(res.blob())
      }).catch((error) => {
        console.log(error)
      })
      const newtrack = {
        'playlistid': req.body.playlistid,
        'name': req.body.name,
        'link': req.body.link,
        'image': req.body.image,
        'artist': req.body.artist,
      }
      const user = await sql`insert into playlistdetails ${sql(newtrack, 'playlistid', 'name', 'link', 'image', 'artist')}  ON CONFLICT (playlistid, name) DO NOTHING returning playlistdetails.*`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * @param {key, playlistid, name }
 * @return {user}
 */
app.post("/delPlaylistTrack", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = {}
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const user = await sql`delete from playlistdetails where playlistid = ${req.body.playlistid} and name = ${req.body.name} returning playlistdetails.*`
      if (user.length != 0)
        data = user
    }
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

//CHAT BOTS

app.post("/askAI", jsonParser, async (req, res, next) => {
  try {
    const response = req.body;
    let data = ""
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const chatSession = model.startChat({
        generationConfig,
        safetySettings,
      });
      const result = await chatSession.sendMessage(`${req.body.question}`);
      console.log(result.response)
      data = result.response.text()
    }
    res.send(data)
  } catch (error) {
    console.log(error)
    next(error)
    res.send("Cannot chat to the AI right now")
  }
})

app.listen(3000, () => {
  console.log("Server running on port 3000");
});