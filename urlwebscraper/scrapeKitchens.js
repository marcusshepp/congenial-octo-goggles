// puppeteer for browser automation and fs for file system operations
import puppeteer from "puppeteer";
import fs from "fs";

// get the search term from commandline arguments or default to kitchen designs
const searchTerm = process.argv[2] || "kitchen designs";

// file path for the log where results will be stored
const logFilePath =
    "C:\\Users\\IMMORTAL STUDIOS\\Desktop\\urlscraper\\urlwebscraper\\scrape.log";

// limit for the maximum number of URLs to scrape (this scrapes only x number of urls, does not account for urls that do not have relevant images yet)
const MAX_URLS = 5;

// loading spinner in cli for funzies :D
let loaderInterval;
const loaderFrames = ["-", "\\", "|", "/"];
let frameIndex = 0;

// function to start  loading spinner in the console
function startLoader(text) {
    process.stdout.write(text);
    loaderInterval = setInterval(() => {
        process.stdout.write(`\r${text} ${loaderFrames[frameIndex]}`);
        frameIndex = (frameIndex + 1) % loaderFrames.length;
    }, 200); // changing frame every 200 ms
}

// function to stop the loader and display a success message
function stopLoader(successMessage) {
    clearInterval(loaderInterval);
    process.stdout.write(`\r${successMessage}\n`);
}

// main function to scrape webpage urls
async function scrapeWebpageURLs() {
    startLoader("Launching browser...");

    // launch the browser with a visible ui
    const browser = await puppeteer.launch({
        headless: false,  // browser UI will be visible
        defaultViewport: null,
        slowMo: 100, // slowing down for debugging purposes. TODO: remove this when approved by marcus
    });

	// create a new browser tab
    const page = await browser.newPage();  

    // setting user agent to mimic a real browser request
    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36"
    );

    stopLoader("Browser launched successfully!");  // stop loader after launching browser

    // encode the search term to be included in the google search url
    const searchQuery = encodeURIComponent(searchTerm);

    // start loader for search operation
    startLoader(`Searching for "${searchTerm}"...`);

    // navigate to the google search results page for the search term
    await page.goto(`https://www.google.com/search?q=${searchQuery}`, {
        waitUntil: "networkidle2",
        timeout: 0,  // disabling timeout to allow long operations (TODO: may want to adjust this when running in production)
    });

    // check if google displays a consent button and click it if present
    const consentButton = await page.$('button[aria-label="I agree"]');
    if (consentButton) {
        console.log("Consent dialog detected, clicking the consent button...");
        await consentButton.click();  // clicking the I agree button
        await page.waitForNavigation({ waitUntil: "networkidle2" }); 
    }

    // start loader for waiting on search results to load
    startLoader("Waiting for search results to load...");
    await page.waitForSelector("a", { timeout: 60000 });

    // start loader for extracting URLs
    startLoader("Extracting webpage URLs...");

    // scrape all the links from the Google search results page, filter out non-relevant urls
    const webpageURLs = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a")); // get all anchor elements on the page
        return links
            .map((link) => link.href)
            .filter(
                (href) =>
                    href.includes("http") &&  // ensure the link contains http
                    !href.includes("google.com") && 
                    !href.includes("/search?") &&
                    !href.includes("#")
            );
    });

    // if no relevant urls were found close browser and exit the process
    if (webpageURLs.length === 0) {
        console.log("No relevant webpages found");
        await browser.close();
        process.exit(0);
        return;
    }

    // filter the scraped urls for pages containing relevant images
    const filteredResults = await filterPagesWithRelevantImages(
        webpageURLs.slice(0, MAX_URLS),
        browser,
        searchTerm
    );

    // if any results were found log them to a file
    if (filteredResults.length > 0) {
        logResults(filteredResults);
    } else {
        console.log("No webpages with relevant images found.");
    }

    // stop the loader and close the browser
    stopLoader("Scraping completed successfully!");
    await browser.close();
    process.exit(0);
}

// function to log the filtered results to a file
function logResults(filteredResults) {
    // formatting logged results
    const logData = filteredResults
        .map((result) => {
            const urls = result.imageURLs.join("\n  ");
            return `${result.pageURL}\n  ${urls}\n`;
        })
        .join("\n");

    // appending the logged data to the specified file
    fs.appendFile(logFilePath, logData, (err) => {
        if (err) {
            console.error("Error writing to log file:", err);
        } else {
            console.log("Results successfully logged to", logFilePath);
        }
    });
}

//fFunction to visit each webpage, check for relevant images, and filter results
async function filterPagesWithRelevantImages(webpageURLs, browser, searchTerm) {
    const searchKeywords = searchTerm.toLowerCase().split(/\s+/);
    const filteredResults = []; 
    let totalURLsLogged = 0;

    // iterate through each url and check for relevant images
    for (let url of webpageURLs) {
        if (totalURLsLogged >= MAX_URLS) {
            console.log(`Reached the limit of ${MAX_URLS} URLs. Stopping...`);
            break;
        }

        console.log(`Checking: ${url}`);
        const page = await browser.newPage();
        try {
            // navigate to the url and wait until the page is fully loaded
            await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

            // scan the page to find images that match the search keywords
            const relevantImages = await page.evaluate((searchKeywords) => {
                const images = Array.from(document.querySelectorAll("img"));
                return images
                    .filter((img) => {
                        const src = img.src.toLowerCase();
                        const matchingKeywords = searchKeywords.filter((keyword) =>
                            src.includes(keyword)
                        ).length; 
                        return matchingKeywords > 0;
                    })
                    .map((img) => img.src);
            }, searchKeywords);

            // if relevant images are found, log the URL and the images
            if (relevantImages.length > 0) {
                console.log(
                    `Relevant images found on: ${url} (${relevantImages.length} images)`
                );
                totalURLsLogged += 1;
                filteredResults.push({
                    pageURL: url,
                    imageURLs: relevantImages,
                });
            } else {
                console.log(`No relevant images found on: ${url}`);
            }
        } catch (error) {
            console.error(`Error visiting ${url}:`, error);
        } finally {
            await page.close();
        }
    }

    return filteredResults;
}

// main function to start the scraping process
(async () => {
    let filteredResults = [];

    try {
        filteredResults = await scrapeWebpageURLs();  // start the url scraping process
    } catch (error) {
        console.error("An error occurred during scraping:", error);
        if (filteredResults.length > 0) {
            logResults(filteredResults);
            console.log("Partial results were logged before the error occurred.");
        }
        process.exit(1);
    }
})();
