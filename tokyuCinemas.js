const puppeteer = require('puppeteer');

module.exports = {
    scrape: async() => {
        // 109シネマズ 川崎の当日の上映スケジュール
        const THEATER_SCHED_URL = 'https://109cinemas.net/kawasaki/';
        // 上映時刻のどれくらい前までチケットを販売しているか
        const SALE_THRESHOLD = 20;
        // チケット販売期限のどれくらい前から販売状況を調べるか
        const CHECK_THRESHOLD = 20;

        await (async() => {
            try {
                const browser = await puppeteer.launch();
                const page = await browser.newPage();
                await page.setViewport({
                    width: 1000,
                    height: await page.evaluate(() => document.body.clientHeight),
                });
                await page.goto(THEATER_SCHED_URL);
                await page.waitFor(2000);
                const frame = await page.frames().find(f => f.name() === 'iframe');
                const schedLinks = await frame.$$('div#timetable > article > ul > li > a');
                // ループに必要な情報を先に集める
                // see https://stackoverflow.com/questions/56345544/trouble-clicking-on-different-links-using-puppeteer/56349839
                // see https://www.code-adviser.com/detail_55877263
                let elms = [];
                let screenNum;
                for (const schedLink of schedLinks) {
                    const href = await (await schedLink.getProperty('href')).jsonValue();
                    const theatreNumTag = await schedLink.$('span.theatre-num');
                    if (theatreNumTag) {
                        screenNum = await (await theatreNumTag.getProperty('textContent')).jsonValue();
                    }
                    const timeTag = await schedLink.$('time.start');
                    if (timeTag) {
                        const startTimeStr = await (await timeTag.getProperty('textContent')).jsonValue();
                        elms.push({
                            screenNum: screenNum,
                            href: href,
                            startTimeStr: startTimeStr
                        });
                    }
                }
                // selectorで取ったハンドルは遷移には使わない
                for (const elm of elms) {
                    const screenNum = elm.screenNum;
                    const href = elm.href;
                    const startTimeStr = elm.startTimeStr;

                    // 東宝シネマズは上映開始時刻の20分前までチケット販売している
                    // see https://109cinemas.net/faq/online-ticket.html
                    let checkThresholdTime = new Date();
                    checkThresholdTime.setHours(startTimeStr.split(':')[0]);
                    checkThresholdTime.setMinutes(startTimeStr.split(':')[1]);
                    checkThresholdTime.setMinutes(checkThresholdTime.getMinutes() - SALE_THRESHOLD - CHECK_THRESHOLD);
                    // console.log('現在時刻が販売終了' + CHECK_THRESHOLD + '分前(' + checkThresholdTime + ')を過ぎている上映の座席状況をみる');
                    const now = new Date();
                    // 販売期限が切れているものはhrefが設定されていない
                    if ((href !== undefined) && now.getTime() > checkThresholdTime.getTime()) {
                        // const id = href.match(/\((.+)\)/)[1].replace(/"/g, '').replace(/ /g, '').replace(/,/g, '_');
                        await page.goto(href, {waitUntil: 'domcontentloaded'});
                        await page.waitFor(2000);
                        const ticketBodyTds =  await page.$$('div.ticketInfoBody > table > tbody > tr > td');
                        const title = await (await ticketBodyTds[0].getProperty('textContent')).jsonValue();
                        const theaterName = await (await ticketBodyTds[1].getProperty('textContent')).jsonValue();
                        const screenName = await (await ticketBodyTds[2].getProperty('textContent')).jsonValue();
                        const showDate = await (await ticketBodyTds[3].getProperty('textContent')).jsonValue();
                        const showTime = await (await ticketBodyTds[4].getProperty('textContent')).jsonValue();
                        const ssTarget = 'div#s150' + screenNum.padStart(2, '0');
                        const targetHandle = await page.$(ssTarget);
                        await targetHandle.screenshot({
                            path: theaterName + title + showDate + showTime + '.png'
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
