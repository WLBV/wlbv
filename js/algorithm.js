import dotenv from 'dotenv'
dotenv.config()
import { Api } from "./api.js";
import { BinanceApi } from "./binanceApi.js";
import ccxt from 'ccxt'


var apiKey = process.env.API_KEY;
var api = new Api(apiKey);
var binanceApi = new BinanceApi(process.env.BAPI_KEY)

export class CryptoAlgorithm {
    async runOnce() {

        const binanceClient = new ccxt.binance({
            apiKey: process.env.BAPI_KEY
        });

        const bPrice = await binanceClient.fetchTrades( "BTCUSDT", undefined, 10, undefined);


        var account = await api.account();
        console.log(account);


        if(typeof account === "object" ){

            var symbolsToSell = account.symbols.filter(p => p.quantity > 0 && p.name != "USDT");
            console.log(symbolsToSell);
            if(symbolsToSell.length > 0){
                var orderHistory = await api.orderHistory();
                for(const s of symbolsToSell){
                    if(typeof orderHistory === "object"){
                     

                        const sHystory = await binanceClient.fetchTrades( s.name + "USDT", undefined, 10, undefined);

                        var price = sHystory.reverse()[0];
                        console.log(price);


                        if(typeof sHystory === "object"){

                            var lastOrder = orderHistory.reverse().find(o => o.symbol === s.name && o.side === "BUY")
                            var priceDiff = price.price - lastOrder.price;
                            console.log(s.name +": "+ priceDiff);
                            var lastFiverecords = sHystory.slice(Math.max(sHystory.length - 5, 1));

                            if(
                                (priceDiff < 0 && this.isLowLimit(price.price, lastOrder.price))
                                ||
                                (priceDiff > 0 && this.isHighLimit(price.price, lastOrder.price))
                            
                            ){
                                
                                await api.order({ symbol: s.name, side: 'SELL', quantity: s.quantity });
                                console.log("SELL: " + s.name + " " + s.quantity + " " + price.price + " =" +  priceDiff * s.quantity);
                            }
                        }
                    }

                }


            }
        }
            

        console.log("Before Midle sleep");
        await this.sleep(process.env.SLEEP);
        console.log("After Midle sleep");

        var account = await api.account();
        console.log(account);

  

        if(typeof account === "object" ){
            var symbolsToBuy = account.symbols.filter(p => p.quantity == 0 );
            console.log(symbolsToBuy);
            if(account.estimatedValue > 100 && symbolsToBuy.length > 0){

                for(const s of symbolsToBuy){
                    
                    const sHystory = await binanceClient.fetchTrades( s.name + "USDT", undefined, 10, undefined);

                    var price = sHystory.reverse()[0];
                    console.log(price);
                    
                    if(typeof sHystory === "object" ){
                    
                        var lastFiverecords = sHystory.slice(Math.max(sHystory.length - 5, 1));

                        if(this.isPriceRising(price, lastFiverecords)){

                            var amountToBuy = 50 / price.price;
                            await api.order({ symbol: s.name, side: 'BUY', quantity: amountToBuy });
                            console.log("BUY: " + s.name + " " + amountToBuy + " " + price.price);

                        }
                    }

                }

            }
        }

        
    }

    isPriceRising(currentPrice, historyArray){
        console.log(currentPrice.symbol);
        console.log(currentPrice.price);
        console.log(historyArray[0].price);

        console.log(currentPrice.price >= historyArray[0].price);

        return currentPrice.price >= historyArray[0].price; // Close price

    }

    isPriceFailing(currentPrice, historyArray){
        var contor = 0;
        for(const h of historyArray){
            if(currentPrice.price < h.price){
                contor++;
            }else{
                contor--;
            }
        }
        return contor > 0;
    }

    isLowLimit(currentPrice, buyPrice){
        var failPercentageLimit = process.env.LOW;
        var priceDiff = currentPrice - buyPrice;

        if(priceDiff > 0 ){
            return false;
        }else{
            var percent = (Math.abs(priceDiff) * 100) / buyPrice;
            const isLimitReached = percent > failPercentageLimit;
            return isLimitReached;
        }
    }

    isHighLimit(currentPrice, buyPrice){
        var highPercentageLimit = process.env.HIGH;
        var priceDiff = currentPrice - buyPrice;

        if(priceDiff < 0 ){
            return false;
        }else{
            var percent = (priceDiff * 100) / buyPrice;


            const isLimitReached = percent >= highPercentageLimit;

            return isLimitReached;
        }
    }


    sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    } 



}