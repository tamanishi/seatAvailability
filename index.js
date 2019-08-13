const puppeteer = require('puppeteer');

// TOHOシネマズ 川崎の当日の上映スケジュール
const THEATER_SCHED_URL = 'https://hlo.tohotheater.jp/net/schedule/010/TNPI2000J01.do';
// 上映時刻のどれくらい前までチケットを販売しているか
const SALE_THRESHOLD = 20;
// チケット販売期限のどれくらい前から販売状況を調べるか
const CHECK_THRESHOLD = 10;

(async() => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setViewport({
            width: 1000,
            height: await page.evaluate(() => document.body.clientHeight),
        });
        await page.goto(THEATER_SCHED_URL);
        const schedLinks = await page.$$('.wrapper');
        // ループに必要な情報を先に集める
        // see https://stackoverflow.com/questions/56345544/trouble-clicking-on-different-links-using-puppeteer/56349839
        // see https://www.code-adviser.com/detail_55877263
        let elms = [];
        for (const schedLink of schedLinks) {
            const href = await (await schedLink.getProperty('href')).jsonValue();
            const startTimeStr = await (await (await schedLink.$('p.time > span.start')).getProperty('textContent')).jsonValue();
            // TODO: SCREEN名を含めたい
            elms.push({
                href: href,
                startTimeStr: startTimeStr
            });
        }
        // selectorで取ったハンドルは遷移には使わない
        for (const elm of elms) {
            const href = elm.href;
            const startTimeStr = elm.startTimeStr;

            // 東宝シネマズは上映開始時刻の20分前までチケット販売している
            // see http://help.tohotheater.jp/faq/show/123?category_id=45&site_domain=default
            let checkThresholdTime = new Date();
            checkThresholdTime.setHours(startTimeStr.split(':')[0]);
            checkThresholdTime.setMinutes(startTimeStr.split(':')[1]);
            checkThresholdTime.setMinutes(checkThresholdTime.getMinutes() - SALE_THRESHOLD - CHECK_THRESHOLD);
            // console.log('現在時刻が販売終了' + CHECK_THRESHOLD + '分前(' + checkThresholdTime + ')を過ぎている上映の座席状況をみる');
            const now = new Date();
            // 販売期限が切れているものはhrefが設定されていない
            if ((href !== undefined) && now.getTime() > checkThresholdTime.getTime()) {
                const id = href.match(/\((.+)\)/)[1].replace(/"/g, '').replace(/ /g, '').replace(/,/g, '_');
                await page.evaluate(href);
                await page.waitFor(2000); 
                const title = await (await (await page.$('.message-movie-title')).getProperty('textContent')).jsonValue();
                // console.log(title);
                const showDate = await (await (await page.$('.message-showdate')).getProperty('textContent')).jsonValue();
                // console.log(showDate);
                const theaterName = await (await (await page.$('.message-theater-name')).getProperty('textContent')).jsonValue();;
                // console.log(theaterName);
                await page.evaluate(({}) => {
                    $('#wedget_ticketOrderInfo-seats').css('display', 'none');
                }, {});
                const ssTarget = '#screen_box_inner';
                const targetHandle = await page.$(ssTarget);
                await targetHandle.screenshot({
                    path: theaterName + title + showDate + '.png'
                });
            }
        }
        await browser.close();
    } catch(e) {
        console.log(e);
    }
})();
