import axios from 'axios';
import * as cheerio from 'cheerio';

const LUNCH_URL = 'https://www.restaurangtegel.com/lunch/';

/**
 * Scrape lunch menu from Restaurang Tegel
 * @returns {Promise<Object>} Lunch menu data
 */
export async function scrapeLunchMenu() {
  try {
    console.log('Fetching lunch menu from:', LUNCH_URL);

    // Fetch the HTML
    const response = await axios.get(LUNCH_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
      }
    });

    // Load HTML into cheerio
    const $ = cheerio.load(response.data);

    // Log the title to verify we got the right page
    console.log('Page title:', $('title').text());

    // Try to find the lunch menu content
    let content = '';

    // More specific selectors for WordPress/Divi sites
    const possibleSelectors = [
      '#main-content .et_pb_text',          // Divi main content text modules
      '.et_pb_section .et_pb_text',         // Divi section text modules
      '.et_pb_row .et_pb_column .et_pb_text', // Divi column text modules
      'article .et_pb_text',                // Article text modules
      '.entry-content',                     // WordPress entry content
      '#main-content',                      // Main content div
      'article',                            // Fallback to article
    ];

    for (const selector of possibleSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        console.log(`Found ${elements.length} elements with selector: ${selector}`);

        // Collect all matching elements
        const htmlParts = [];
        elements.each((_i, elem) => {
          const html = $(elem).html();
          if (html && html.trim().length > 50) { // Only include substantial content
            htmlParts.push(html);
          }
        });

        if (htmlParts.length > 0) {
          content = htmlParts.join('\n');
          console.log(`Using content from selector: ${selector}`);
          break;
        }
      }
    }

    // If no content found with specific selectors, try main content area
    if (!content) {
      const mainContent = $('#main-content');
      if (mainContent.length > 0) {
        content = mainContent.html();
        console.log('Using #main-content as fallback');
      }
    }

    // Last resort: get the main post content
    if (!content) {
      const postContent = $('.post-content, .entry-content, article');
      if (postContent.length > 0) {
        content = postContent.first().html();
        console.log('Using post/entry content as fallback');
      }
    }

    // Clean up the content
    if (content) {
      const $cleaned = cheerio.load(content);

      // Remove scripts, styles, and unwanted elements
      $cleaned('script, style, noscript, .et_pb_button_wrapper, nav, header, footer').remove();

      // Remove empty paragraphs
      $cleaned('p').each((_i, elem) => {
        if (!$(elem).text().trim()) {
          $cleaned(elem).remove();
        }
      });

      // Get clean HTML
      content = $cleaned.html();
    }

    // If still no content, provide a helpful message
    if (!content || content.trim().length < 50) {
      content = '<div><p><strong>Lunchmenyn kunde inte laddas automatiskt.</strong></p><p>Besök <a href="https://www.restaurangtegel.com/lunch/" target="_blank" rel="noopener noreferrer">restaurangens webbplats</a> för att se veckans lunchmeny.</p></div>';
      console.log('No substantial content found, using fallback message');
    }

    return {
      content: content,
      lastUpdated: new Date().toISOString(),
      source: LUNCH_URL
    };
  } catch (error) {
    console.error('Error scraping lunch menu:', error.message);
    throw new Error(`Failed to fetch lunch menu: ${error.message}`);
  }
}

export default { scrapeLunchMenu };
