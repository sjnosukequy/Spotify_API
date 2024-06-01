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


var urlencodedParser = bodyParser.urlencoded({ extended: true }) // Middleware to parse URL-encoded data
var jsonParser = bodyParser.json() // Middleware to parse JSON data

// CORS (Cross-Origin Resource Sharing) options
const corsOptions = {
  // origin: "https://mplayer1.netlify.app",
  // origin: "http://localhost:8081", //your frontend url here

  // Allow credentials (cookies, authorization headers, etc.) to be sent in cross-site requests
  credentials: true, //access-control-allow-credentials:true
  // HTTP status code to be sent on successful OPTIONS request
  optionSuccessStatus: 200,
  // Expose all headers to the client
  exposedHeaders: "**",
};

// Use the CORS middleware with the specified options
app.use(cors(corsOptions));

// Define a route for downloading audio from a YouTube video
app.get("/download", async (req, res, next) => {
  // console.log(req.query.url);
  try {
    // Extract the video URL from the query parameters
    const videoUrl = req.query.url;
    // Fetch video information using ytdl
    const videoInfo = await ytdl.getInfo(videoUrl);
    // Filter the formats to get only audio formats with 'mp4' container
    const audioFormats = ytdl.filterFormats(videoInfo.formats, "audioonly").filter(item => item.container == 'mp4');
    // console.log(audioFormats);
    // const urls = audioFormats.map((item) => item.url);
    // Send the URL of the first audio format found
    res.send(audioFormats[0].url);
  } catch (error) {
    // Pass any errors to the next middleware (error handler)
    next(error);
  }
});

app.get("/main", async (req, res) => {
  // console.log(req.query);
  // Define options for launching Puppeteer with a headless browser and various performance optimizations
  const options = {
    args: [
      '--no-sandbox',                     // Disable sandbox for security
      '--disable-setuid-sandbox',         // Disable setuid sandbox
      '--disable-dev-shm-usage',          // Disable /dev/shm usage
      '--disable-accelerated-2d-canvas',  // Disable 2D canvas acceleration
      '--no-first-run',                   // Skip first run wizards
      '--no-zygote',                      // Disable the zygote process
      '--single-process',                 // Run as a single process
      '--disable-gpu'                     // Disable GPU hardware acceleration
    ],
    headless: true                        // Run browser in headless mode
  }
  // Launch a new browser instance with the specified options
  const browser = await puppeteer.launch(options);
  try {
    // Open a new page in the browser
    const page = await browser.newPage();

    // Define a custom user agent
    const customUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36';

    // Set the viewport dimensions for the page
    await page.setViewport({ width: 1000, height: 890 });
    // Enable request interception to selectively block certain resource types
    await page.setRequestInterception(true);

    page.on('request', (req) => {
      if (req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image') {
        req.abort(); // Abort requests for stylesheets, fonts, and images to speed up loading
      }
      else {
        req.continue(); // Allow other requests to proceed
      }
    });

    // Set the custom user agent for the page
    await page.setUserAgent(customUA);

    // Navigate to the specified YouTube channel URL
    await page.goto('https://www.youtube.com/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ');
    // await page.goto('https://www.youtube.com/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ', { waitUntil: 'load' });

    // Take a screenshot of the page and save it locally
    await page.screenshot({ path: '1.png' });

    // Evaluate JavaScript within the page context to scrape the desired data
    const data = await page.evaluate(() => {
      document.body.scrollIntoView(false);// Scroll to the bottom of the page

      // Select recommended albums section and map over the contents to extract data
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

      return urls; // Return the scraped data
    });

    // Close the browser instance
    await browser.close();
    // Send the scraped data as the response
    res.send(data)
  }
  catch (error) {
    // In case of an error, ensure the browser is closed and handle the error
    await browser.close();
  }
});

// Endpoint to fetch playlist data from a given YouTube URL
app.get("/playlist", async (req, res, next) => {
  const options = {
    args: [
      '--no-sandbox',                     // Disable sandbox for security reasons
      '--disable-setuid-sandbox',         // Disable setuid sandbox
      '--disable-dev-shm-usage',          // Disable /dev/shm usage
      '--disable-accelerated-2d-canvas',  // Disable accelerated 2D canvas
      '--no-first-run',                   // Skip first run wizards
      '--no-zygote',                      // Disable the zygote process
      '--single-process',                 // Run as a single process
      '--disable-gpu'                     // Disable GPU hardware acceleration
    ],
    headless: true                        // Run browser in headless mode
  }

  // Launch a new browser instance with the specified options
  const browser = await puppeteer.launch(options);
  try {
    // console.log(req.query);
    // Open a new page in the browser
    const page = await browser.newPage();

    // Define a custom user agent to mimic a regular browser request
    const customUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36';

    // Set the custom user agent for the page
    await page.setUserAgent(customUA);

    // Set the viewport dimensions for the page
    await page.setViewport({
      width: 960,
      height: 540
    });

    // Enable request interception to selectively block certain resource types
    await page.setRequestInterception(true);

    page.on('request', (req) => {
      if (req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image') {
        req.abort(); // Abort requests for stylesheets, fonts, and images to speed up loading
      }
      else {
        req.continue(); // Allow other requests to proceed
      }
    });

    // Navigate to the provided YouTube playlist URL
    await page.goto(`https://www.youtube.com/${req.query.url}`);
    // await page.goto(`https://www.youtube.com/${req.query.url}`, { waitUntil: 'load' });
    // Take a screenshot of the page for debugging or verification purposes
    await page.screenshot({ path: '1.png' });

    // Evaluate JavaScript within the page to scrape the desired data
    const data = await page.evaluate(() => {
      // Select all tracks from the playlist
      const tracks = document.querySelector('#contents.style-scope.ytd-section-list-renderer').querySelector('#contents').querySelector('#contents').querySelectorAll('ytd-playlist-video-renderer');
      const urls = Array.from(tracks).map((Selection, index) => {
        const link_str = Selection.querySelector('a').getAttribute('href').split('&')[0];
        return {
          name: Selection.querySelector('h3').querySelector('a').innerHTML.trim(),          // Extract the track name
          link: link_str,                                                                   // Extract the track link
          image: `https://img.youtube.com/vi/${link_str.split('?v=')[1]}/sddefault.jpg`,    // Construct the image URL
          // image: Selection.querySelector('a').querySelector('img').getAttribute('src'),
          artist: Selection.querySelector('#metadata').querySelector('a').innerHTML.trim()  // Extract the artist name
        };
      });
      return urls; // Return the scraped data
    });

    // Take another screenshot for debugging purposes
    await page.screenshot({ path: `0.png` });

    // Close the browser instance
    await browser.close();

    // Send the scraped data as the response
    res.send(data)
  }
  catch (error) {
    // Handle errors by closing the browser and calling the next middleware
    data = `https://www.youtube.com/${req.query.url} Link does not exist`;
    await browser.close();
    next(error);
    // res.send(data)
  }

})

// Endpoint to get the average color from an image URL
app.post("/getcolor", jsonParser, async (req, res, next) => {
  try {
    // Fetch the image from the provided URL
    const response = await axios.get(
      req.body.url,
      { responseType: 'arraybuffer' }
    );
    const buffer = Buffer.from(response.data, 'binary');

    // Calculate the average color of the image
    getAverageColor(buffer).then(color => {
      // console.log(color);
      res.send({ avg: color.hex }) // Send the average color as the response
    }).catch(error => {
      console.log(error)
      res.send({ avg: '#0000000' }) // Default to black color in case of an error
    });

  }
  catch (error) {
    next(error); // Handle errors by calling the next middleware
    // res.send(error)
  }
})

// Endpoint to get the average color from an image URL
app.get("/getcolor", async (req, res, next) => {
  try {

    // Fetch the image from the provided URL
    const response = await axios.get(
      req.query.url, // URL of the image
      { responseType: 'arraybuffer' } // Response type set to 'arraybuffer' to handle binary data
    );
    // Convert the response data to a buffer
    const buffer = Buffer.from(response.data, 'utf-8');

    // Calculate the average color of the image
    getAverageColor(buffer).then(color => {
      // console.log(color);
      res.send({ avg: color.hex }) // Send the average color as the response
    }).catch(error => {
      console.log(error)
      res.send({ avg: '#0000000' }) // Default to black color in case of an error
    });

  }
  catch (error) {
    // Handle errors by calling the next middleware and sending the error response
    next(error);
    res.send(error)
  }
})

// Endpoint to search for music on YouTube Music and fetch additional data from a database
app.get("/search", async (req, res, next) => {
  // Puppeteer launch options for headless browser
  const options = {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ],
    headless: true
  }

  // Launching the Puppeteer browser
  const browser = await puppeteer.launch(options);
  try {

    // console.log(req.query);
    const page = await browser.newPage();

     // Custom user agent to simulate a real browser
    const customUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36';
    await page.setUserAgent(customUA);
    
    // Setting viewport dimensions
    await page.setViewport({
      width: 960,
      height: 540
    });

    // Intercepting requests to block unnecessary resources
    await page.setRequestInterception(true);

    page.on('request', (req) => {
      if (req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image') {
        req.abort();
      }
      else {
        req.continue();
      }
    });

    // Navigating to YouTube Music search results page
    await page.goto(`https://music.youtube.com/search?q=${req.query.url}`);
    // await page.goto(`https://music.youtube.com/search?q=${req.query.url}`, { waitUntil: 'load' });

    await page.waitForSelector('ytmusic-shelf-renderer', { visible: true })

    // Taking a screenshot for debugging
    await page.screenshot({ path: '1.png', fullPage: true });

    // Extracting song and album data from the search results page
    let data = await page.evaluate(async () => {

      // Select all shelf renderers on the page (containers for various sections like songs, albums, etc.)
      const lists_obj = document.querySelectorAll('ytmusic-shelf-renderer');
      let idx1 = 0; // Index for the 'Songs' section
      let idx2 = 0; // Index for the 'Community playlists' section
      const length = Array.from(lists_obj).length // Total number of shelf renderers

      // Iterate through the list of shelf renderers to find the indices for 'Songs' and 'Community playlists'
      for (let i = 0; i < length; i++) {
        const name = lists_obj[i].querySelector('h2').querySelector('yt-formatted-string').innerHTML.trim();
        if (name == 'Songs')
          idx1 = i;
        else if (name == 'Community playlists')
          idx2 = i;
      }

      // Select all song items in the 'Songs' section
      const songs = lists_obj[idx1].querySelectorAll('ytmusic-responsive-list-item-renderer')

      // Map over each song item to extract the necessary details
      const song_urls = Array.from(songs).map((Selection, index) => {
        Selection.scrollIntoView('false'); // Ensure the item is scrolled into view (false means scroll to bottom)
        const link_str = Selection.querySelector('a').getAttribute('href'); // Get the link of the song

        // Return an object with song details
        return {
          name: Selection.querySelector('a').innerHTML?.trim() || 'Failed to load',
          link: `/${link_str}`,
          image: `https://img.youtube.com/vi/${link_str.split('?v=')[1]}/sddefault.jpg`,
          // image: Selection.querySelector('a').querySelector('img').getAttribute('src'),
          artist: Selection.querySelectorAll('yt-formatted-string')[1].querySelector('a').innerHTML?.trim() || 'Failed to load'
        };
      });

      // Select all album items in the 'Community playlists' section
      const albums = lists_obj[idx2].querySelectorAll('ytmusic-responsive-list-item-renderer')
      // Map over each album item to extract the necessary details
      const album_urls = Array.from(albums).map((Selection, index) => {
        Selection.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" }); // Smooth scroll into view
        const link_str = Selection.querySelectorAll('a')[0].getAttribute('href'); // Get the link of the album
        let img = Selection.querySelector('img').getAttribute('src'); // Get the image source
        if (img.includes("data:")) // If the image source includes 'data:', set it to null
          img = null

        // Return an object with album details
        return {
          title: Selection.querySelectorAll('a')[0].getAttribute('aria-label').trim(),
          link: `/${link_str}`,
          img: img,
          // image: Selection.querySelector('a').querySelector('img').getAttribute('src'),
          info: Selection.querySelectorAll('a')[1].innerHTML?.trim() || 'Failed to load'
        };
      });

      // Combine the extracted song and album details into a single object
      urls = {
        'songs': song_urls,
        'albums': album_urls,
      }

      return urls; // Return the combined data
    });

    // Construct a search pattern for the SQL query
    const se = `%${req.query.url}%`
    // Query the database to get album details matching the search pattern
    const album2 = await sql`select a.title, a.image as img, a.info, a.id from album a where a.title ilike ${se}`
    // Query the database to get song details matching the search pattern
    const song2 = await sql`select t.title as name, t.link , t.image, u.username as artist  from track t inner join users u on t.userid = u.id where t.title ilike ${se}`

    data['album2'] = album2 // Add the results of the album query to the data object
    data['song2'] = song2 // Add the results of the song query to the data object

    // await page.screenshot({ path: `0.png` });

    // let length = data['albums'].length

    // for (let i = 0; i < length; i++) {
    //   await page.goto(`https://music.youtube.com${data['albums'][i].link}`, { waitUntil: 'load' })
    //   await page.screenshot({ path: `${i + 3}.png` })
    //   const url = await page.url();
    //   data['albums'][i].link = url.split('.com/')[1]
    // }

    await browser.close(); // Close the Puppeteer browser instance

    // Send the combined data as the response
    res.send(data)
  }
  catch (error) {
    // Ensure the Puppeteer browser instance is closed in case of an error
    await browser.close();
    // Pass the error to the next middleware function for error handling
    next(error);
    // res.send(error)
  }

})


//SQL PATH

// Endpoint to get user information based on username/email and password
/**
 * @param {key, username, password  }
 * @return {user}
 */
app.post("/getUser", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = null
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Construct the SQL query to find a user by username/email and password
      const string = `select * from users where username = '${req.body.username}' or email = '${req.body.username}' and password = '${req.body.password}' `
      const user = await sql`select * from users where (username = ${req.body.username} or email = ${req.body.username}) and password = ${req.body.password} `
      // If the user is found, set the data to the user information
      if (user.length != 0)
        data = user
    }
    // Send the user information (or null if not found) as the response
    res.send(data)
  }
  catch (error) {
    // Pass the error to the next middleware function for error handling
    next(error);
    res.send("error occur")
  }
})

// Endpoint to get admin information based on username/email and password
/**
 * @param {key, username, password  }
 * @return {user}
 */
app.post("/getAdmin", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = [{}] // Initialize data with an empty object array to ensure the response is always an array
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Construct the SQL query to find an admin by username/email and password
      const user = await sql`select u.*, 'admin' as role from users u inner join "admin" a on u.id = a.id where (u.username=${req.body.username} or u.email=${req.body.username}) and u."password" =${req.body.password}`
      // If the admin is found, set the data to the admin information
      if (user.length != 0)
        data = user
    }
    // Send the admin information (or empty object array if not found) as the response
    res.send(data)
  }
  catch (error) {
    // Pass the error to the next middleware function for error handling
    next(error);
    res.send("error occur")
  }
})

// Endpoint to get artist information based on username/email and password
/**
 * @param {key, username, password  }
 * @return {user}
 */
app.post("/getArtist", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = [{}] // Initialize data with an empty object array to ensure the response is always an array
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Construct the SQL query to find an artist by username/email and password
      const user = await sql`select u.*, 'artist' as role from users u inner join "artist" a on u.id = a.id where (u.username=${req.body.username} or u.email=${req.body.username}) and u."password" =${req.body.password}`
      // If the artist is found, set the data to the artist information
      if (user.length != 0)
        data = user
    }
    // Send the artist information (or empty object array if not found) as the response
    res.send(data)
  }
  catch (error) {
    // Pass the error to the next middleware function for error handling
    next(error);
    res.send("error occur")
  }
})

// Endpoint to insert an artist into the database
/**
 * @param {key, username, password }
 * @return {user}
 */
app.post("/upArtist", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = [{}] // Initialize data with an empty object array to ensure the response is always an array
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Execute the SQL function to insert a new artist with the provided username and password
      const user = await sql`SELECT * FROM insert_artist(${req.body.username}, ${req.body.password});`
      // If the insertion was successful and a user is returned, set the data to the user information
      if (user.length != 0)
        data = user
    }
    // Send the user information (or empty object array if insertion failed) as the response
    res.send(data)
  }
  catch (error) {
    // Pass the error to the next middleware function for error handling
    next(error);
    res.send("error occur")
  }
})

// Endpoint to fetch all users who are not admins
/**
 * @param {key}
 * @return {user}
 */
app.post("/getUsers", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = null // Initialize data as null to represent no users found initially
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Execute the SQL query to fetch users who are not admins
      const user = await sql`select u.* from users u left join "admin" a on u.id = a.id where a.id is null`
      // If users are found, set the data to the user information
      if (user.length != 0)
        data = user
    }
    // Send the user information (or null if no users found) as the response
    res.send(data)
  }
  catch (error) {
    // Pass the error to the next middleware function for error handling
    next(error);
    res.send("error occur")
  }
})

/**
 * Endpoint to add a new user
 * @param {key, username, password, emal, nickname}
 * @return {user} Returns the added user or an error message
 */ 
app.post("/addUser", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = null // Initialize data as null
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Check if the username or email already exists in the database
      const user = await sql`select * from users where (username = ${req.body.username} or email = ${req.body.email})`
      // If a user with the same username or email already exists, set data to indicate it
      if (user.length != 0)
        data = 'Already exist user'
      else {
        // If the username and email are unique, prepare the new user object
        const newuser = {
          'username': req.body.username,
          'email': req.body.email,
          'nickname': req.body.nickname,
          'password': req.body.password,
          'ban': false
        }
        // Insert the new user into the database and return the user information
        data = await sql` insert into users ${sql(newuser, 'username', 'email', 'nickname', 'password', 'ban')} returning id,username,email,nickname,password,ban`
      }
    }
    // Send the added user or error message as the response
    res.send(data)
  }
  catch (error) {
    // Pass the error to the next middleware function for error handling
    next(error);
    res.send("error occur")
  }
})


/**
 * Endpoint to ban users by their IDs
 * @param {key, ids:[[3], [5]]}
 * @return {user} Returns the updated user information or an error message
 */
app.post("/banUser", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = null // Initialize data as null
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Update the users' ban status based on the provided IDs
      data = await sql`
      update users set ban = true
      from (values ${sql(response.ids)}) as update_data(id)
      where users.id = update_data.id
      returning users.id, users.username, users.email, users.ban`
    }
    // Send the updated user information or error message as the response
    res.send(data)
  }
  catch (error) {
    // Pass the error to the next middleware function for error handling
    next(error);
    res.send("error occur")
  }
})


/**
 * Endpoint to update user information
 * @param {key, username, password, emal, nickname, id}
 * @return {user} Returns the updated user information or an error message
 */
app.post("/updateUser", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = null // Initialize data as null
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      const newuser = {
        'id': req.body.id,
        'username': req.body.username,
        'email': req.body.email,
        'nickname': req.body.nickname,
        'password': req.body.password
      }
      // Update the user information in the database
      data = await sql`
      update users set ${sql(newuser, 'username', 'email', 'nickname', 'password')}
      where users.id = ${newuser.id}
      returning users.*`
    }
    // Send the updated user information or error message as the response
    res.send(data)
  }
  catch (error) {
    // Pass the error to the next middleware function for error handling
    next(error);
    res.send("error occur")
  }
})


/**
 * Endpoint to unban users based on their IDs
 * @param {key, ids:[[3], [5]]}
 * @return {user} Returns the updated user information or an error message
 */
app.post("/unbanUser", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = null // Initialize data as null
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Update the user ban status in the database to false for the provided IDs
      data = await sql`
      update users set ban = false
      from (values ${sql(response.ids)}) as update_data(id)
      where users.id = update_data.id
      returning users.id, users.username, users.email, users.ban`
    }
    // Send the updated user information or error message as the response
    res.send(data)
  }
  catch (error) {
    // Pass the error to the next middleware function for error handling
    next(error);
    res.send("error occur")
  }
})

/**
 * Endpoint to retrieve albums created by a specific artist
 * @param {key, username }
 * @return {user} Returns the albums created by the artist or an error message
 */
app.post("/getArtistAlbums", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = {} // Initialize data as an empty object
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Query the database to retrieve albums created by the artist with the given username
      const user = await sql`select a.*, u2.username  from album a inner join artist u on a.userid = u.id inner join users u2 on u.id = u2.id where u2.username = ${req.body.username}`
      // If albums are found, assign the result to the data variable
      if (user.length != 0)
        data = user
    }
    // Send the retrieved albums or an error message as the response
    res.send(data)
  }
  catch (error) {
    // Pass the error to the next middleware function for error handling
    next(error);
    res.send("error occur")
  }
})

/**
 * Endpoint to retrieve a specific artist's album by its ID
 * @param {key, id }
 * @return {user} Returns the album data or an error message
 */
app.post("/getArtistAlbum", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = {} // Initialize data as an empty object
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Query the database to retrieve the album with the given ID
      const user = await sql`select * from album a where a.id = ${req.body.id}`
      // If the album is found, assign the result to the data variable
      if (user.length != 0)
        data = user
    }
    // Send the retrieved album or an error message as the response
    res.send(data)
  }
  catch (error) {
    // Pass the error to the next middleware function for error handling
    next(error);
    res.send("error occur")
  }
})

/**
 * Endpoint to update an artist's album
 * @param {key, title, userid, imagem info, id }
 * @return {user} Returns the updated album data or an error message
 */
app.post("/updateArtistAlbum", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = {} // Initialize data as an empty object
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Update the album in the database with the provided details
      const user = await sql`update album
      set title =${req.body.title}, userid = ${req.body.userid}, image =${req.body.image}, info = ${req.body.info}
      where id = ${req.body.id}
      returning album.*`
      // If the album is updated successfully, assign the updated album data to the data variable
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
 * Endpoint to delete an artist's album
 * @param {key, id }
 * @return {user} Returns the deleted album data or an error message
 */
app.post("/delArtistAlbum", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = {} // Initialize data as an empty object
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Delete tracks associated with the album from the database
      await sql`DELETE FROM track 
      WHERE albumid = ${req.body.id}`
      // Delete the album from the database and return the deleted album data
      const user = await sql`delete from album 
      where id = ${req.body.id} returning album.*`
      // If the album is deleted successfully, assign the deleted album data to the data variable
      if (user.length != 0)
        data = user
    }
    // Send the deleted album data or an error message as the response
    res.send(data)
  }
  catch (error) {
    // Pass the error to the next middleware function for error handling
    next(error);
    res.send("error occur")
  }
})

/**
 * Endpoint to add an album for an artist
 * @param {key, title, userid, image, info }
 * @return {user} Returns the added album data or an error message
 */
app.post("/addArtistAlbum", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = {} // Initialize data as an empty object
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Create a new album object with the provided data
      const newtrack = {
        'title': req.body.title,
        'userid': req.body.userid,
        'image': req.body.image,
        'info': req.body.info
      }
      // console.log(newtrack)
      // Insert the new album into the database and return the added album data
      const user = await sql` insert into album ${sql(newtrack, 'title', 'userid', 'image', 'info')} returning album.*`
      // If the album is added successfully, assign the added album data to the data variable
      if (user.length != 0)
        data = user
    }
    // Send the added album data or an error message as the response
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})


/**
 * Endpoint to retrieve songs of an artist
 * @param {key, username }
 * @return {user} Returns the songs of the artist or an error message
 */
app.post("/getArtistsongs", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = {} // Initialize data as an empty object
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Retrieve songs of the artist from the database
      const user = await sql`select a.*, u2.username,a2.title as album_title from track a inner join artist u on a.userid = u.id 
      inner join users u2 on u.id = u2.id
      inner join album a2 on a.albumid = a2.id 
      where u2.username = ${req.body.username}`
      // If songs are found, assign them to the data variable
      if (user.length != 0)
        data = user
    }
    // Send the artist's songs or an error message as the response
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * Endpoint to retrieve a specific song by its ID
 * @param {key, id }
 * @return {user} Returns the requested song or an error message
 */
app.post("/getArtistsong", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = {} // Initialize data as an empty object
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Retrieve the song with the specified ID from the database
      const user = await sql`select * from track t where t.id = ${req.body.id}`
      // If the song is found, assign it to the data variable
      if (user.length != 0)
        data = user
    }
    // Send the requested song or an error message as the response
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * Endpoint to update a specific song's details
 * @param {key, title, albumid, image, id }
 * @return {user} Returns the updated song or an error message
 */
app.post("/updateArtistsong", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = {} // Initialize data as an empty object
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Update the song's details in the database
      const user = await sql`update track 
      set title = ${req.body.title}, albumid = ${req.body.albumid}, image = ${req.body.image}
      where track.id = ${req.body.id} returning track.*`
      // If the song is updated successfully, assign it to the data variable
      if (user.length != 0)
        data = user
    }
    // Send the updated song or an error message as the response
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * Endpoint to delete a specific song
 * @param {key, id }
 * @return {user} Returns the deleted song or an error message
 */
app.post("/delArtistsong", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = {} // Initialize data as an empty object
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Delete the song from the database
      const user = await sql`delete from track 
      where id = ${req.body.id} returning track.*` // Return the deleted song details
      // If the song is deleted successfully, assign it to the data variable
      if (user.length != 0)
        data = user
    }
    // Send the deleted song or an error message as the response
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * Endpoint to add a new song by an artist
 * @param {key, title, userid, albumid, image, link }
 * @return {user} Returns the added song or an error message
 */
app.post("/addArtistsong", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = {} // Initialize data as an empty object
    // Check if the provided key matches the expected key
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // const newuser = {
      //   'username': req.body.username,
      //   'email': req.body.email,
      //   'nickname': req.body.nickname,
      //   'password': req.body.password,
      //   'ban': false
      // }
      // data = await sql` insert into users ${sql(newuser, 'username', 'email', 'nickname', 'password', 'ban')} returning id,username,email,nickname,password,ban`

      // Define the new track data to be inserted
      const newtrack = {
        'title': req.body.title,
        'userid': req.body.userid,
        'albumid': req.body.albumid,
        'image': req.body.image,
        'link': req.body.link
      }
      // Insert the new track into the database
      const user = await sql` insert into track ${sql(newtrack, 'title', 'userid', 'albumid', 'image', 'link')} returning track.*` // Return the added track details
      // If the track is added successfully, assign it to the data variable
      if (user.length != 0)
        data = user
    }
    // Send the added track or an error message as the response
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * Endpoint to fetch songs belonging to a specific album
 * @param {url:albumid } 
 * @return {album} Returns an array of songs belonging to the specified album
 */
app.get("/getAlbumSong", async (req, res, next) => {
  try {
    let data = [] // Initialize data as an empty array
    // Query the database to fetch songs belonging to the specified album ID
    const user = await sql`select t.title as name, t.link , t.image, u.username as artist  
    from track t inner join users u on t.userid = u.id
    where t.albumid = ${req.query.url}`
    // If songs are found for the specified album, assign them to the data variable
    if (user.length != 0)
      data = user
    // Send the fetched songs as the response
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send(error)
  }
})

/**
 * Endpoint to fetch playlists belonging to a specific user
 * @param {url:userid }   
 * @return {playlist id} Returns an array of playlist IDs belonging to the specified user
 */
app.get("/getUserPlaylists", async (req, res, next) => {
  try {
    let data = [] // Initialize data as an empty array
    // Query the database to fetch playlist IDs belonging to the specified user ID
    const user = await sql`select id from playlist p where p.userid = ${req.query.url}` // Use the user ID from the request URL
    // If playlists are found for the specified user, assign them to the data variable
    if (user.length != 0)
      data = user
    // Send the fetched playlist IDs as the response
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send(error)
  }
})

/**
 * Endpoint to fetch songs belonging to a specific playlist
 * @param {url:playlistid }
 * @return {songs} Returns an array of songs belonging to the specified playlist
 */
app.get("/getPlaylistSongs", async (req, res, next) => {
  try {
    let data = [] // Initialize data as an empty array
    // Query the database to fetch songs belonging to the specified playlist ID
    const user = await sql`select * from playlistdetails p where p.playlistid = ${req.query.url}` // Use the playlist ID from the request URL
    // If songs are found for the specified playlist, assign them to the data variable
    if (user.length != 0)
      data = user
    // Send the array of songs as the response
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send(error)
  }
})

/**
 * Endpoint to add a new playlist
 * @param {key, title, userid, image, info }
 * @return {user} Returns the newly added playlist
 */
app.post("/addPlaylist", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = {} // Initialize data as an empty object
    // Check if the provided key matches the expected key for authentication
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {

      // Construct the object containing playlist details
      const newtrack = {
        'userid': req.body.userid,
        'title': req.body.title,
        'image': req.body.image,
        'info': req.body.info
      }
      // Insert the new playlist into the database and return the inserted playlist
      const user = await sql`insert into playlist ${sql(newtrack, 'title', 'userid', 'image', 'info')} returning playlist.*`
      // If the playlist is successfully added, assign it to the data variable
      if (user.length != 0)
        data = user
    }
    // Send the added playlist as the response
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * Endpoint to add a new track to a playlist
 * @param {key, playlistid, name, link, image, artist }
 * @return {user} Returns the newly added track
 */
app.post("/addPlaylistTrack", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = {} // Initialize data as an empty object
    // Check if the provided key matches the expected key for authentication
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Construct the object containing track details
      const newtrack = {
        'playlistid': req.body.playlistid,
        'name': req.body.name,
        'link': req.body.link,
        'image': req.body.image,
        'artist': req.body.artist,
      }
      // Insert the new track into the playlistdetails table, ignoring conflicts
      const user = await sql`insert into playlistdetails ${sql(newtrack, 'playlistid', 'name', 'link', 'image', 'artist')}  ON CONFLICT (playlistid, name) DO NOTHING returning playlistdetails.*`
      // If the track is successfully added, assign it to the data variable
      if (user.length != 0)
        data = user
    }
    // Send the added track as the response
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

/**
 * Endpoint to delete a track from a playlist
 * @param {key, playlistid, name }
 * @return {user} Returns the deleted track
 */
app.post("/delPlaylistTrack", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = {} // Initialize data as an empty object
    // Check if the provided key matches the expected key for authentication
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Delete the track from the playlistdetails table where playlistid and name match the provided values
      const user = await sql`delete from playlistdetails where playlistid = ${req.body.playlistid} and name = ${req.body.name} returning playlistdetails.*`
      // If the track is successfully deleted, assign it to the data variable
      if (user.length != 0)
        data = user
    }
    // Send the deleted track as the response
    res.send(data)
  }
  catch (error) {
    next(error);
    res.send("error occur")
  }
})

//CHAT BOTS
//Endpoint to ask a question to the AI model
app.post("/askAI", jsonParser, async (req, res, next) => {
  try {
    const response = req.body; // Extract the request body
    let data = "" // Initialize data as an empty string
    // Check if the provided key matches the expected key for authentication
    if (response.key == "8/k0Y-EJj5S>#/OIA>XB?/q7}") {
      // Start a new chat session with the AI model using the specified configuration
      const chatSession = model.startChat({
        generationConfig,
        safetySettings,
      });
      // Send the question to the AI and await its response
      const result = await chatSession.sendMessage(`${req.body.question}`);
      // Log the AI's response to the console for debugging
      console.log(result.response)
      // Extract the text response from the result and assign it to the data variable
      data = result.response.text()
    }
    // Send the AI's response as the response to the client
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