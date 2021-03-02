'use strict';


var globalParams = {
    "SerialPort": {
        "DeviceAddress": 0,
        "PortName": "COM4",
        "Baudrate": 38400
    },
    "Base": {
        "PollingInterval": 1000,
        "PollingTimeout": 800
    }
};

var logger = {
    "stampLog": function(str) {
        let argDate = new Date();
        let hour = ('0' + argDate.getHours()).slice(-2);
        let minute = ('0' + argDate.getMinutes()).slice(-2);
        let second = ('0' + argDate.getSeconds()).slice(-2);
        let milli = ('00' + argDate.getMilliseconds()).slice(-3);

        //return `${year}/${month}/${day} ${hour}:${minute}:${second}`;
        let date2str = `${hour}:${minute}:${second}.${milli}`;
        console.log(`[${date2str}] ${str}`);
    }
}

// ライブラリ取得
const fs = require('fs');
const async = require('async');

const os = require('os');
const request = require('request');

var last_updated_dt = new Date();   // DBに追加した最終日時

// ================== シリアル通信関連 ==================
// シリアル通信用ライブラリ
const Serialport = require('serialport');                // シリアル通信
var serial;     // オブジェクトの実態は定期処理で作成

// シリアルポートに接続する
function connectSerialPort(portName) {

    try {

        // シリアルポート
        serial = new Serialport(
            //"/dev/ttyACM0",    // mbedの場合
            //"/dev/ttyUSB0",    //製品の場合
            //`/dev/${globalParams.SerialPort.PortName}`,
            portName,
            {
                baudRate: globalParams["SerialPort"]["Baudrate"],
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                flowControl: true
            }
        );

        // 受信時のイベントハンドラを定義
        serial.on('data', function (arrRecvBytes) {


            try {
                serialState = SerialState.RECEIVING;    // 受信中

                // 受信データを解析（→受信完了で受信完了イベント発行へ）
                orionMasterProtocol.addRecvArray(
                    arrRecvBytes,
                    function (arrAllRecvBytes) {
                        logger.stampLog(`シリアル通信 製品→Raspi  ${arrAllRecvBytes.length} bytes`);

                        // ポーリング応答データをデータ配列として処理する
                        handleReceivedData(
                            arrAllRecvBytes
                        );
                    }
                );

            } catch (e) {
                logger.stampLog(`▲serial.on('data': ${e}`);
                disposeSerialPort();
            }
        });
        
        serial.on('close', function (err) {
            logger.stampLog(`シリアル通信 切断イベント`);
            serialState = SerialState.INIT;
        });

        //logger.stampLog(`シリアルポートに接続完了 /dev/${globalParams.SerialPort.PortName}`);
        logger.stampLog(`シリアルポートに接続完了 ${portName}`);
        serialState = SerialState.RECEIVED;

    } catch (e) {
        logger.stampLog(`▲orionMasterProtocol.addRecvArray(): ${e}`);
        disposeSerialPort();
    }
}

// 例外発生時にシリアルポートを初期化する
function disposeSerialPort() {

    try {
        serial.close(function () {
            logger.stampLog(`シリアル通信 切断完了`);
            serial = null;
        });
    } catch (e) {
        logger.stampLog(`▲disposeSerialPort() ${e}`);
    }
    serialState = SerialState.INIT;
}

// ポーリング発行側インスタンス
const OriMasterProtocol = require('./my_lib/OriMasterProtocol.js');
var orionMasterProtocol = new OriMasterProtocol();

const RemoteControllerProtocol = require('./my_lib/RemoteControllerProtocol.js');
var remoteControllerProtocol = new RemoteControllerProtocol();

// M1通信で取得kしたデータを配列変数として保持する
var docs = [];  // 複数回分のM1データ
const MAX_DOCS = 450;   // 保持するM1データの数
function handleReceivedData(arrAllRecvBytes) {

    let one = {
        datetime: new Date(),
        M1: (arrAllRecvBytes !== null) ? arrAllRecvBytes.map(function (num) { return Number(num); }) : null
    };

    docs.push(one);

    if (docs.length >= MAX_DOCS) {
        docs.shift();
    }

    serialState = SerialState.RECEIVED;
}



// ■■■■■■■■■■■■■■■■■■■■■■■■■ 初期化処理 ■■■■■■■■■■■■■■■■■■■■■■■■■


// 温度センサデータを１度読み込んでからメイン処理を開始
async.waterfall([
    function (next) {

        main();     // メイン処理
        next(null, null);
    }
    
], function (err, results) {
    if (err) {
        logger.stampLog("err[" + err + "]");
    }
    logger.stampLog(`～初期化処理完了～：${results}`);
});





// ■■■■■■■■■■■■■■■■■■■■■■■■■ メインの定期通信関連 ■■■■■■■■■■■■■■■■■■■■■■■■■

var SerialState = {
    INIT: "INIT",
    WRITING: "WRITING",
    WROTE: "WROTE",
    RECEIVING: "RECEIVING",
    RECEIVED: "RECEIVED"
};
var serialState = SerialState.INIT;

function main() {

    var intervalID;
    intervalID = setInterval(function () {

        try {
            // 送信処理
            if (serial && serial.isOpen) {

                serialState = SerialState.WRITING;  // 送信中

                // 送信データを取得
                let pollingData = orionMasterProtocol.getPollingBytes(globalParams["SerialPort"]["DeviceAddress"], "M1");

                // シリアルポートへ送信
                serial.write(pollingData, function (err, results) {

                    serialState = SerialState.WROTE;  // 送信済み

                    try {
                        // 送信エラーなし
                        if (!err) {
                            logger.stampLog(`シリアル通信 Raspi→製品  ${pollingData.length} bytes`);
                            // 送信エラー
                        } else {
                            logger.stampLog("Error:シリアルポート送信エラー");
                            logger.stampLog(err);
                            logger.stampLog(results);
                            logger.stampLog();
                            disposeSerialPort();
                        }

                    } catch (e) {
                        logger.stampLog(`▲orionMasterProtocol.addRecvArray(): ${e}`);
                        disposeSerialPort();
                    }
                });
                
                // 受信タイムアウト監視
                var serialTimeoutID = setTimeout(function () {

                    switch (serialState) {
                        case SerialState.INIT:
                        case SerialState.WRITING:
                        case SerialState.WROTE:
                        case SerialState.RECEIVING:
                            logger.stampLog(`シリアル通信タイムアウト`);
                            // 受信データなし。シリアル通信以外から取得するデータのみロギング。
                            handleReceivedData(null);
                            break;
                        case SerialState.RECEIVED:
                            // シリアル送受信OK
                            break;
                    }

                }, globalParams.Base.PollingTimeout);

            } else {
                //stopComm(`シリアルポートが切断されているため、定期通信を停止しました。`);
                logger.stampLog(`シリアルポート接続中...`);


                // 使用可能なシリアル
                // ポートをリストアップ
                Serialport.list().then(function (ports) {
                    //すべての使用可能なCOMポートを列挙
                    //logger.stampLog(`使用可能なCOMポート数：${ports.length}`);
                    //logger.stampLog(`使用可能なCOMポート`);
                    ports.forEach(function (port) {
                        logger.stampLog(`comName:${port.path}, vendorId:${port.vendorId}, productId:${port.productId}`);
                        //if(port.path == `/dev/${globalParams.SerialPort.PortName}`)

                        if (port.path === globalParams["SerialPort"]["PortName"]) {
                            // ポート指定の場合
                            connectSerialPort(port.path);
                        }

                        else if (port.vendorId === "0403") {
                            // FTDIデバイスの場合

                            // TTL-USB変換器
                            if (port.path.startsWith('/dev/ttyUSB') === true) {
                                connectSerialPort(port.path);
                            }
                        }

                        else if (port.path.startsWith('/dev/ttyACM0')) {
                            // ARM mbedの場合

                            connectSerialPort(port.path);
                        }
                    });
                });
            }
        } catch (e) {
            logger.stampLog(`▲intervalID = setInterval() : ${e}`);
            disposeSerialPort();
        }


        //for (let i = 0; i < 8; i++ ) {
        //    logger.stampLog(`CH${i + 1}:${voltageIC_MCP3208.voltageValue[i]}`);
        //}

    }, globalParams.Base.PollingInterval);

    temperature = "";

    setInterval(() => {

        request(`https://myfirstwebapp0302.azurewebsites.net/set/temp=${temperature}`, (error, response, body) => {
          // エラーチェック
          if( error !== null ){
            console.error('error:', error);
            return(false);
          }
        
          // レスポンスコードとHTMLを表示
          console.log('statusCode:', response && response.statusCode);
          console.log('body:', body);
        });

    }, 1000);

    logger.stampLog(`定期通信を開始しました。インターバル：${globalParams.Base.PollingInterval}msec`);

}
