'use strict';

const MAX_DATA_LENGTH = 3000;

// 受信状態
var recvStateType = {
    watingFEFEXXXXzw: 0,
    watingFEFEXXXXrc: 1
};

module.exports = class RemoteControllerProtocol {
    constructor() {
        this.recvData = [];
        this.recvState = recvStateType.watingFEFEXXXXrc;
        this.size = 0;
    }

    //// BCC値を取得する
    //getBCC(dataArray) {

    //    var afterSTX = false;
    //    var bcc = 0;

    //    for (i = 0; i < dataArray.length; i++) {

    //        if (dataArray[i] === ASCIIChar.STX) {
    //            afterSTX = true;
    //        }

    //        if (afterSTX) {
    //            bcc ^= dataArray[i];
    //            if (dataArray[i] === ASCIIChar.ETX) {
    //                break;
    //            }
    //        }
    //    }

    //    return bcc;
    //}

    // 受信データ配列に引数のデータ配列を追加する
    addRecvArray(argArray, argCallback) {

        //console.log(this.recvData.length);
        for (var i = 0; i < argArray.length; i++) {

            this.recvData.push(argArray[i]);
            let len = this.recvData.length - 1;

            if (this.recvData.length >= MAX_DATA_LENGTH) {
                this.recvData = [];
                this.recvData.push(argArray[i]);
                this.recvState = recvStateType.watingFEFEXXXXrc;
            }


            else if (len >= 6
                && this.recvData[len - 5] === 0xFE
                && this.recvData[len - 4] === 0xFE
                && this.recvData[len - 1] === 'r'.charCodeAt(0)
                && this.recvData[len - 0] === 'c'.charCodeAt(0)) {
                //console.log("FEFE rc");
                this.recvData = [];
            }


            else if (len >= 6
                && this.recvData[len - 5] === 0xFE
                && this.recvData[len - 4] === 0xFE
                && this.recvData[len - 1] === 'z'.charCodeAt(0)
                && this.recvData[len - 0] === 'w'.charCodeAt(0)) {
                //console.log("FEFE zw");
                this.recvState = recvStateType.watingFEFEXXXXzw;
                this.size = this.recvData[len - 3] * 256 + this.recvData[len - 2];
                this.recvData = ['z'.charCodeAt(0), 'w'.charCodeAt(0)];
            }

			/*
            else if (len >= 1 && this.recvData[len - 1] === 'r'.charCodeAt(0) && this.recvData[len] === 'c'.charCodeAt(0)) {
			//else if (len >= 1 && this.recvData[len - 1] === 0xFE && this.recvData[len] === 0xFE) {
				console.log("rc " + this.recvState + " " + len);

                if (this.recvState === recvStateType.watingFEFEXXXXzw) {
					console.log("callback");
                    argCallback(this.recvData);
                }

            	// 初期化
            	this.recvData = [0xFE, 0xFE];
            	//this.recvData = [0xFE, 0xFE];
            	this.recvState = recvStateType.watingFEFEXXXXrc;
            }
			*/
            if (len >= this.size + 2 && this.recvState === recvStateType.watingFEFEXXXXzw) {
                //console.log("callback");
                argCallback(this.recvData);
                this.recvState === recvStateType.watingFEFEXXXXrc;
                this.recvData = [];
            }
        }
    }
};

