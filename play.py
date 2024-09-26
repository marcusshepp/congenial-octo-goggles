from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup as bs
import requests
import string
import random

ua = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/69.0.3497.100 Safari/537.36"
)


def get_urls_from_file():
    urls = []

    with open('sites.txt', 'r') as f:
        lines = [line.rstrip() for line in f if not line.startswith('#')]
        urls = lines
    return urls


def id_generator(size=6, chars=string.ascii_uppercase + string.digits):
    return ''.join(random.choice(chars) for _ in range(size))


def extract_img_src_from_tag(img_tags):
    srcs = []
    no_srcs = []
    for image in img_tags:
        src = image.get('src')
        if src:
            if 'http' not in src:
                src = src.replace('//', '')
                src += '{0}{1}'.format('http://', src)
            srcs.append(src)
        else:
            src = image.get('data-src')
            if src:
                srcs.append(src)
            if not src:
                no_srcs.append(image)

    if False:
        with open('test-imgs.txt', 'w+') as f:
            for src in srcs:
                f.write(src)
                f.write('\n')
        with open('test-no-srcs.txt', 'w+') as f:
            for src in no_srcs:
                f.write(str(src))
                f.write('\n')
            f.write('no of no src: {0}'.format(len(no_srcs)))
    print('has src: {}'.format(len(srcs)))
    print('has no src: {}'.format(len(no_srcs)))
    return srcs


def write_imgs_to_files(src_urls):
    count_files_written = 0
    for src in src_urls:
        try:
            img_data = requests.get(src).content
        except:
            continue
        with open('imgs/{0}.jpg'.format(str(id_generator())), 'wb+') as f:
            count_files_written += 1
            f.write(img_data)
    return count_files_written


def main():
    count_files_written = 0
    for url in get_urls_from_file():
        if count_files_written == 0:
            html = ''
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=False)
                page = browser.new_page(user_agent=ua)
                page.goto(url)
                page.wait_for_timeout(0)
                html = page.content()
                page.close()
            soup = bs(html, 'html.parser')
            img_tags = soup.find_all('img')
            srcs = extract_img_src_from_tag(img_tags)
            number_of_files_created = write_imgs_to_files(srcs)
            count_files_written += number_of_files_created
    print('images created: {}'.format(count_files_written))


main()
