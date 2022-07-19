/******************************************************************************
*  @desc: 爬取 "联合早报" - 中国即时新闻 当天新闻列表并发送至指定邮箱
*  @date: 2022-07-12 17:16:13
* ***************************************************************************/
const request = require('request');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const nodemailer = require( 'nodemailer' );
const smtpTransport = require( 'nodemailer-smtp-transport' );

var news = [];
var pageNews = [];
var apiNews = [];
var currentDay = new Date();
var m = currentDay.getMonth() + 1;
var d = currentDay.getDate();
var dayStr = '';
m = m < 10 ? `0${m}` : m;
d = d < 10 ? `0${d}` : d;
dayStr = `${m}-${d}`; // 格式：07-12，用来与新闻发布日期进行对比，以确实是否当天的内容

// 获取接口的新闻列表
const APIRequest = () => {
    var newsRequest = [];

    // 一次性爬取10页数据，反正一天内不可能有那么多的新闻内容
    for (let pageNo = 3; pageNo <= 7; pageNo++) {
        newsRequest.push(
            new Promise((resolve, reject) => {
                request({
                    url: `https://www.zaobao.com/more/sitemap/3?pageNo=${pageNo}&pageSize=9`,
                    json: true,
                    headers: {
                        "content-type": "application/json",
                    },
                }, function (error, response, body) {
                    if (!error && response.statusCode == 200) {
                        apiNews = [...apiNews, ...body.result.data]
                        resolve();
                    }
                });
            })
        )
    }

    return Promise.all([...newsRequest]).then(() => {
        apiNews = apiNews.map(item => {
            // 只爬取当天的新闻内容
            if (item.publicationDate.indexOf(dayStr) > -1) {
                return {
                    title: item.title,
                    date: dayStr,
                    href: `https://www.zaobao.com/${item.url}`
                }
            }

        }).filter(Boolean);
    })
};


// 获取页面的第一、二页新闻列表
const PageRequest = () => {
    return new Promise((resolve, reject) => {
        request({
            url: 'https://www.zaobao.com/realtime/china',
            encoding: null //设置encoding
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var buf = iconv.decode(body, 'utf-8').toString(); //解码gb2312
                var $ = cheerio.load(buf);
                var $list = $('.list-block');

                if ($list.length > 0) {
                    $('.list-block').each((index, element) => {
                        const href = $(element).attr('href');
                        const contentText = $(element).text().split('\n').filter(Boolean);
                        const title = contentText[0];
                        const date = contentText[1];

                        // 只爬取当天的新闻内容, 防止有时候新闻内容过少，会出现多天的新闻内容（概率极低）
                        if (date === dayStr) {
                            pageNews.push({
                                title: title,
                                date: date,
                                href: `https://www.zaobao.com/${href}`
                            })
                        }
                    })
                }

                resolve();
            }
        });
    }).then(() => { })
};

(async () => {
    var html = '';

    await APIRequest();
    await PageRequest();

    news = [...pageNews, ...apiNews];

    for (let i = 0; i < news.length; i++) {
        const item = news[i];
        html += `<a href="${item.href}" target="_blank" attr-index="${i + 1}">${item.title}</a>`;
    }

    html = `
    <div class="custom-news-list">
        <style>
            .custom-news-list a {
                position: relative;
                padding: 5px 0 5px 22px;
                display: block;
                font: 14px/22px Arial,sans-serif;
                line-height: 1.54;
                color: #2440b3;
                text-decoration: none!important;
            }
            .custom-news-list a::before {
                content: attr(attr-index);
                padding: 4px 0 ;
                position: absolute;
                top: 0;
                left: 0;
                color: #9195A3;
                line-height: 1.54;
            }
            .custom-news-list a:visited {
                color: #333;
            }
            .custom-news-list a:hover {
                color: #315efb;
                text-decoration: underline!important;
            }
            .custom-news-list a:active {
                color: #f73131;
            }
            .custom-news-list a:nth-child(1)::before{
                color: #FE2D46;
                font-size: 15px;
            }
            .custom-news-list a:nth-child(2)::before{
                color: #F60;
                font-size: 15px;
            }
            .custom-news-list a:nth-child(3)::before{
                color: #FAA90E;
                font-size: 15px;
            }
        </style>
        ${html}
    </div>
    `;
    
    // 创建发送邮件的请求对象
    const transport = nodemailer.createTransport( smtpTransport( {
        // 邮箱主机
        host: 'smtp.qq.com',
        //使用 SSL
        secure: true,
        // 使用 SSL
        secureConnection: true,
        // SMTP 端口
        port: 465,
        auth: {
            // 发送方邮箱地址
            user: 'fasongfang@qq.com',
            // smtp 验证码 - 参考http://www.scicat.cn/jingyan/20210812/5714111.html
            pass: 'xxx'
        }
    } ) );

    transport.sendMail( {
            // 发送方邮箱
        from: 'fasongfang@qq.com',
        // 抄送
        // cc: 'cc@qq.com',
        // 对方邮箱地址, 可以同时发送多个, 以逗号隔开  
        to: 'shoujianfang@qq.com',
        // 标题
        subject: `${dayStr} 早报新闻列表`,
        // html格式
        html: html,
    }, ( err, info ) => {
        if ( err ) {
            console.log('发送失败');
        } else {
            console.log('发送成功');
        }
        transport.close();
    } );
})();

