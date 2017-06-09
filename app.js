'use strict'
const axios = require('axios'),
    querystring = require('querystring'),
    schedule = require('node-schedule'),
    fs = require('fs'),
    path = require('path'),
    config = require('./config.json');
const htmlBaseUrl = config.htmlBaseUrl,
    jsonBaseUrl = config.jsonBaseUrl,
    userAgent = config.kUserAgent;

axios.defaults.headers.post['Content-Type'] =
    'application/x-www-form-urlencoded';

let rule = new schedule.RecurrenceRule();
rule.dayOfWeek = config.scheduleTime.days;
rule.hour = config.scheduleTime.hours;
rule.minute = config.scheduleTime.minutes;

const app = {
    init() {
            this.check()
            this.monitor()
        },
        check() {
            var rs = {};
            this.getResultPromiss().then(value => {
                var rsJson = value.data;
                var lo = [];
                for (var i = 0, len = rsJson["ma"].length; i <
                    len; i += 3) {
                    lo.push(rsJson["ma"].slice(i, i +
                        3));
                }
                rs["lotNo"] = rsJson["id"];
                rs["nextLotNo"] = rsJson[
                    "nextid"];
                rs["nextLotTime"] = rsJson[
                        "year"] + "年" + rsJson[
                        "day"] +
                    rsJson["time"] + ' ' + rsJson["week"];
                rs["lottery"] = lo;
                // console.info(rs);
                const title =
                    `${rsJson["year"]}年第${rs["lotNo"]}期开奖啦`;
                const body =
                    `${rsJson["year"]}年第${rs["lotNo"]}期开奖结果：平码【${rs["lottery"][0][0]}, ${rs["lottery"][0][1]}, ${this.colorDict(rs["lottery"][0][2])}】,
                    【${rs["lottery"][1][0]}, ${rs["lottery"][1][1]}, ${this.colorDict(rs["lottery"][1][2])}】,
                    【${rs["lottery"][2][0]}, ${rs["lottery"][2][1]}, ${this.colorDict(rs["lottery"][2][2])}】,
                    【${rs["lottery"][3][0]}, ${rs["lottery"][3][1]}, ${this.colorDict(rs["lottery"][3][2])}】,
                    【${rs["lottery"][4][0]}, ${rs["lottery"][4][1]}, ${this.colorDict(rs["lottery"][4][2])}】,
                    【${rs["lottery"][5][0]}, ${rs["lottery"][5][1]}, ${this.colorDict(rs["lottery"][5][2])}】,
                    特码【${rs["lottery"][6][0]}, ${rs["lottery"][6][1]}, ${this.colorDict(rs["lottery"][6][2])}】,
                     下一期(${rsJson["year"]}年第${rs["nextLotNo"]}期)开奖日：${rs["nextLotTime"]}。`;
                // console.log('Title: ', title)
                // console.log('Body: ', body)
                this.notifyNeeded(rs["lotNo"]).then(value => {
                    this.notify(title, body).then((response) => {
                            if (response.status === 200) {
                                this.historySync(rs[
                                    "lotNo"]);
                                this.notify(title, body,
                                    true);
                                return;
                            }
                            console.log(
                                    'serverChan: send success'
                                )
                                // console.warn(response.status)

                        })
                        .catch((error) => {
                            console.error(error);
                        });
                }).catch(err => {
                    console.info(err);
                    this.notify("开奖结果服务器出错啦", err, true);
                });
            }).catch(err => {
                return;
            });
        },
        colorDict(en) {
            return en == "green" ? "绿" : (en == "red" ? "红" : "蓝");
        },
        monitor() {
            return schedule.scheduleJob(rule, () => {
                this.check()
            })
        },
        notifyNeeded(lotteryNum) {
            var that = this;
            return new Promise(function(resolve, reject) {
                fs.exists('./rc.txt', function(exists) {
                    if (!exists) {
                        resolve(true);
                        return;
                    } else {
                        fs.readFile('./rc.txt', 'utf-8',
                            function(err,
                                data) {
                                if (err) {
                                    // throw err;
                                    console.info(
                                        'false 1');
                                    reject(false);
                                    return;
                                }
                                var rc = JSON.parse(
                                    data);
                                // console.log(rc);
                                if (!rc) {
                                    console.info(
                                        'false 2');
                                    reject(false);
                                    return;
                                }
                                if (rc.lastestNum >=
                                    lotteryNum) {
                                    console.info(
                                        'false 3');
                                    reject(false);
                                    return;
                                }
                                var today2359 = that.dateNow(
                                    true);
                                if (rc.time > today2359) {
                                    console.info(
                                        'false 4');
                                    reject(false);
                                    return;
                                }
                                console.info('true 2');
                                resolve(true);
                            });
                    }
                });
            });
        },
        historySync(lotteryNum) {
            var json = {
                'lastestNum': lotteryNum,
                'time': this.dateNow(true),
                'date': this.dateNow()
            }
            fs.writeFile('./rc.txt', JSON.stringify(json), function(err) {
                if (err) {
                    throw err;
                }
                console.log('Saved.');
            });
        },
        dateNow(timestand) {
            var date = new Date(); //如果date为10位不需要乘1000
            var Y = date.getFullYear() + '-';
            var M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() +
                    1) : date.getMonth() +
                1) + '-';
            var D = (date.getDate() < 10 ? '0' + (date.getDate()) :
                    date.getDate()) +
                ' ';
            // var h = (date.getHours() < 10 ? '0' + date.getHours() :
            // date.getHours()) +
            // ':';
            // var m = (date.getMinutes() <10 ? '0' + date.getMinutes() : date.getMinutes()) + ':';
            // var s = (date.getSeconds() <10 ? '0' + date.getSeconds() : date.getSeconds());
            var combDate = Y + M + D + '23:59:59';
            return timestand ? new Date(combDate).getTime() / 1000 | 0 :
                combDate;
        },

        notify(text, desp, fordaddy) {
            var url = fordaddy ?
                `${config.kServerChanBaseUrl}${config.serverChanDaddyKey}.send` :
                `${config.kServerChanBaseUrl}${config.serverChanKey}.send`;
            return axios.post(url, querystring.stringify({
                text: text,
                desp: desp
            }));
        },
        getResultPromiss() {
            return axios.get(jsonBaseUrl, querystring.stringify({
                client_lang: "zh-tw"
            }));
        }
}
app.init()
    /**
    {
    "lotNo": 66, //最新期数
    "lottery": [[11, "豬", "green"],
                [23, "豬", "red"],
                [8, "虎", "red"],
                [29, "蛇", "red"],
                [15, "羊", "blue"],
                [24, "狗", "red"],
                [6, "龍", "green"]]
    "nextLotNo": 67, //下一期期数
    "nextLotTime": "2017年06月10日 21时30分 星期六"
    }
    **/
