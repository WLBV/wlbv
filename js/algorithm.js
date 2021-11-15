import dotenv from 'dotenv'
dotenv.config()
import { Api } from "./api.js";
import { BinanceApi } from "./binanceApi.js";
import ccxt from 'ccxt'


var apiKey = process.env.API_KEY;
var api = new Api(apiKey);

export class CryptoAlgorithm {
    async runOnce() {

        var account = await api.account();
        console.log(account);
        const symbolsList = process.env.SYMBOLS.split(',');

        if(typeof account === "object" ){

            var symbolsToSell = account.symbols.filter(p => p.quantity > 0 && p.name != "USDT" );

            if(symbolsToSell.length > 0){
                var orderHistory = await api.orderHistory();
                orderHistory.reverse();
                for(const s of symbolsToSell){
                    if(typeof orderHistory === "object"){

                        var price = await api.price({symbol: s.name});
                        console.log(price);

                        var sHystory = await api.symbolHistory({
                            symbol: s.name,
                            interval: "1m"
                        });    


                        if(typeof sHystory === "object"){

                            var lastOrder = orderHistory.find(o => o.symbol === s.name && o.side === "BUY");

                            const currentPrice = price.value;
                            const lastOrderPrice = lastOrder.price;

                            var priceDiff = currentPrice - lastOrderPrice;
                   
                            if(
                                (priceDiff < 0 && this.isLowLimit(currentPrice, lastOrderPrice))
                                ||
                                (priceDiff > 0 && this.isHighLimit(currentPrice, lastOrderPrice))
                            
                            ){
                                
                                await api.order({ symbol: s.name, side: 'SELL', quantity: s.quantity });
                                console.log("SELL: " + s.name + " Qty:" + s.quantity + " CurrentPrice:" + currentPrice + " LastOrderPrice:" + lastOrderPrice + " Profit:" +  priceDiff * s.quantity);
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
            var symbolsToBuy = account.symbols.filter(p => p.quantity == 0 && symbolsList.find(sl => sl === p.name));
            if(account.estimatedValue > process.env.BUY_AMOUNT && symbolsToBuy.length > 0){

                for(const s of symbolsToBuy){

                    var sHystory = await api.symbolHistory({
                        symbol: s.name,
                        interval: "1m"
                    });

                    var price = await api.price({symbol: s.name});
                    console.log(price);

                   
                    
                    if(typeof sHystory === "object" && typeof price === "object" ){

                        var lastFiverecords = sHystory.slice(Math.max(sHystory.length - 5, 1));

                        const currentPrice = price.value;
                        const lastPrice = lastFiverecords.reverse()[0][4];
                    
                        if(this.isPriceRising(currentPrice, lastPrice)){
                            var amountToBuy = process.env.BUY_AMOUNT;
                            await api.order({ symbol: s.name, side: 'BUY', quantity: amountToBuy });
                            console.log("BUY: " + s.name + " ammount:" + amountToBuy + " CurrentPrice:" + currentPrice + " LastPrice:" + lastPrice);

                        }
                    }

                }

            }
        }

        
    }

    isPriceRising(currentPrice, lastPrice){
        console.log("isPriceRising");
        console.log("currentPrice:" + currentPrice + " lastPrice: " + lastPrice);
        return currentPrice >= lastPrice;
    }

    isLowLimit(currentPrice, buyPrice){
        var failPercentageLimit = process.env.LOW;
        var priceDiff = currentPrice - buyPrice;
        console.log("isLowLimit");

        if(priceDiff > 0 ){
            return false;
        }else{
            var percent = (Math.abs(priceDiff) * process.env.BUY_AMOUNT) / buyPrice;
            console.log("currentPrice:" + currentPrice + " buyPrice: " + buyPrice);
            console.log("envPercent:" + failPercentageLimit + " currentPercent: " + percent);
            const isLimitReached = percent > failPercentageLimit;
            return isLimitReached;
        }
    }

    isHighLimit(currentPrice, buyPrice){
        var highPercentageLimit = process.env.HIGH;
        var priceDiff = currentPrice - buyPrice;
        console.log("isHighLimit");
     
        if(priceDiff < 0 ){
            return false;
        }else{
            var percent = (priceDiff * process.env.BUY_AMOUNT) / buyPrice;

            console.log("currentPrice:" + currentPrice + " buyPrice: " + buyPrice);
            console.log("envPercent:" + highPercentageLimit + " currentPercent: " + percent);

            const isLimitReached = percent >= highPercentageLimit;

            return isLimitReached;
        }
    }


    sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    } 

    toFixedNumber(num, symbol){
        const symbolPrecision = [
            {symbol: "BTC", p:2},
            {symbol: "ETH", p:2},
            {symbol: "DOGE", p:4},
            {symbol: "ADA", p:3},
            {symbol: "LTC", p:1},
            {symbol: "MATIC", p:3},
            {symbol: "BNB", p:1},
            {symbol: "EGLD", p:2},
            {symbol: "NEO", p:2},
            {symbol: "SOL", p:2},
            {symbol: "XRP", p:4},
        ];
        const prec = symbolPrecision.find(s => s.symbol === symbol).p;
        var pow = Math.pow(10, prec);
        return Math.round(num*pow) / pow;
    }


}