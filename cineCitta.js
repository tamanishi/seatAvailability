const puppeteer = require('puppeteer');

module.exports = {
    scrape: async() => {
        // チネチッタ川崎の当日の上映スケジュール
        const THEATER_SCHED_URL = 'http://cinecitta.co.jp/schedule/';
        // 上映時刻のどれくらい前までチケットを販売しているか
        const SALE_THRESHOLD = 20;
        // チケット販売期限のどれくらい前から販売状況を調べるか
        const CHECK_THRESHOLD = 10;

        await (async() => {
            try {
                const browser = await puppeteer.launch();
                const page = await browser.newPage();
                await page.setViewport({
                    width: 1000,
                    height: await page.evaluate(() => document.body.clientHeight),
                });
                await page.goto(THEATER_SCHED_URL, {waitUntil: 'domcontentloaded'});
                await page.waitFor(2000);
                const schedLinks = await page.$$('section#displayPortalArea > div.scheduleBox > table > tbody > tr > td');
                // ループに必要な情報を先に集める
                // see https://stackoverflow.com/questions/56345544/trouble-clicking-on-different-links-using-puppeteer/56349839
                // see https://www.code-adviser.com/detail_55877263
                let elms = [];
                for (const schedLink of schedLinks) {
                    const onClick = await page.evaluate((el) => {
                        return el.getAttribute('onclick');
                    }, schedLink);
                    if (onClick) {
                        const screenName = await (await (await schedLink.$('p')).getProperty('textContent')).jsonValue();
                        const startTimeStr = await (await (await schedLink.$('table > tbody > tr > td > span.strong')).getProperty('textContent')).jsonValue();
                        elms.push({
                            onClick: onClick,
                            startTimeStr: startTimeStr,
                            screenName: screenName, 
                        });
                    }
                }
                // selectorで取ったハンドルは遷移には使わない
                for (const elm of elms) {
                    const onClick = elm.onClick;
                    const startTimeStr = elm.startTimeStr;
                    const screenName = elm.screenName;
                    const theaterName = 'チネチッタ川崎';

                    // チネチッタ川崎は上映開始時刻の20分前までチケット販売している
                    // see http://cinecitta.co.jp/ticket/about_cinet/
                    let checkThresholdTime = new Date();
                    checkThresholdTime.setHours(startTimeStr.split(':')[0]);
                    checkThresholdTime.setMinutes(startTimeStr.split(':')[1]);
                    checkThresholdTime.setMinutes(checkThresholdTime.getMinutes() - SALE_THRESHOLD - CHECK_THRESHOLD);
                    // console.log('現在時刻が販売終了' + CHECK_THRESHOLD + '分前(' + checkThresholdTime + ')を過ぎている上映の座席状況をみる');
                    const now = new Date();
                    if (now.getTime() > checkThresholdTime.getTime()) {
                        const url = onClick.match(/\((.+)\)/)[1].replace(/'/g, '').split(',')[0];
                        await page.goto(url);
                        await page.waitFor(2500); 
                        let title;
                            if (await page.$('table#MvTtl > tbody > tr > td')) {
                            title = await (await (await page.$('table#MvTtl > tbody > tr > td')).getProperty('textContent')).jsonValue();
                        } else {
                            continue;
                        }
                        // console.log(title.trim());
                        const showDate = await (await (await page.$('table#date > tbody > tr > td')).getProperty('textContent')).jsonValue();
                        // console.log(showDate.trim());
                        const ssTarget = 'div.T0001S' + screenName.replace('CINE', '').padStart(2, '0');
                        // console.log(ssTarget);
                        const targetHandle = await page.$(ssTarget);
                        // console.log(theaterName + showDate.trim() + '.png');
                        await targetHandle.screenshot({
                            path: theaterName + title.trim() + showDate.trim() + '.png'
                        });
                    }
                }
                await browser.close();
            } catch(e) {
                console.log(e);
            }
        })();
    }
};
