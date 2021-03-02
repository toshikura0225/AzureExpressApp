'use strict';

const MAX_DATA_LENGTH = 3000;

// 受信状態
var recvStateType = {
    watingSTX: 0,
    watingETX: 1,
    watingBCC: 2
};

// ASCIIコード
var ASCIIChar = {
    STX: 2,
    ETX: 3,
    EOT: 4,
    ENQ: 5
};


class OriMasterProtocol {
    constructor() {
        this.recvData = [];
        this.recvState = recvStateType.watingSTX;
    }

    // BCC値を取得する
    getBCC(dataArray) {

        var afterSTX = false;
        var bcc = 0;

        for (let i = 0; i < dataArray.length; i++) {

            if (dataArray[i] === ASCIIChar.STX) {
                afterSTX = true;
            }

            else if (afterSTX) {
                bcc ^= dataArray[i];
                if (dataArray[i] === ASCIIChar.ETX) {
                    break;
                }
            }
        }

        return bcc;
    }

    // ポーリング要求のデータ配列を取得する
    getPollingBytes(address, command) {

        return [ASCIIChar.EOT,
        address / 10 + 0x30,
        address % 10 + 0x30,
        command.charCodeAt(0),
        command.charCodeAt(1),
        ASCIIChar.ENQ];
    }



    // 受信データ配列に引数のデータ配列を追加する
    addRecvArray(argArray, argCallback) {

        for (var i = 0; i < argArray.length; i++) {

            if (this.recvData.length >= MAX_DATA_LENGTH) {

                this.recvData = [];
                this.recvData.push(argArray[i]);
                this.recvState = recvStateType.watingSTX;
            }

            else if (this.recvState === recvStateType.watingBCC) {

                this.recvData.push(argArray[i]);

                // BCCチェック
                if(this.getBCC(this.recvData) === argArray[i]) {
                    argCallback(this.recvData);
                }            

                // 初期化
                this.recvData = [];
                this.recvState = recvStateType.watingSTX;

                break;
            }

            else if (argArray[i] === ASCIIChar.STX) {
                this.recvData = [];
                this.recvData.push(argArray[i]);
                this.recvState = recvStateType.watingETX;
            }

            else if (this.recvState === recvStateType.watingETX) {

                if (argArray[i] === ASCIIChar.ETX) {
                    this.recvState = recvStateType.watingBCC;
                }

                this.recvData.push(argArray[i]);
            }

            else if (this.recvState === recvStateType.watingSTX) {

                // 処理不要

                //if (argArray[i] === ASCIIChar.STX) {
                //    this.recvData = [];
                //    this.recvData.push(argArray[i]);
                //    this.recvState = recvStateType.watingETX;
                //}
            }
        }
    }

    // ポーリング応答データからデータ配列を取得
    getPollingDataArray(argArray) {

        var retDataArray = [];    // 戻り値として返す配列
        var afterSTX = false;    // STXより後のデータか
        var num = 0.0, decimalPlace = 0, afterPoint = false, err = "", isNegative = false;    // 値
        var init = function () { num = 0.0; decimalPlace = 0; afterPoint = false; err = "", isNegative = false; };    // 値を初期化
        var toNum = function (ascii_code) { return ascii_code - 48; };    // ASCIIコードから数値へ

        for (i = 0; i < argArray.length; i++) {
            if (afterSTX) {
                if (argArray[i] === ASCIIChar.ETX) {    // ETX
                    num /= Math.pow(10, decimalPlace);    // 小数化
                    num = isNegative ? -num : num;    // 正負化
                    retDataArray.push(num);
                    break;
                }
                else if (String.fromCharCode(argArray[i]) >= '0' && String.fromCharCode(argArray[i]) <= '9') {    // 数値
                    num = num * 10 + toNum(argArray[i]);
                    decimalPlace = afterPoint ? decimalPlace + 1 : 0;
                }
                else if (String.fromCharCode(argArray[i]) === ' ') {    // スペース
                    continue;
                }
                else if (String.fromCharCode(argArray[i]) === ',') {    // カンマ
                    if (err === "") {
                        num /= Math.pow(10, decimalPlace);
                        num = isNegative ? -num : num;    // 正負化
                        retDataArray.push(num);
                    } else {
                        retDataArray.push(err + num);
                    }
                    init();
                }
                else if (String.fromCharCode(argArray[i]) === '.') {    // ピリオド
                    afterPoint = true;
                }
                else if (String.fromCharCode(argArray[i]) === '-') {    // マイナス符号
                    isNegative = true;
                }
                else if (String.fromCharCode(argArray[i]) === 'C'
                    || String.fromCharCode(argArray[i]) === 'E') {    // 警報
                    err = "" + String.fromCharCode(argArray[i]);
                }
            }
            else {
                if (argArray[i] === ASCIIChar.STX) {    // STX
                    afterSTX = true;
                }
            }
        }

        return retDataArray;
    }

}





module.exports = OriMasterProtocol;