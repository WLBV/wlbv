import dotenv from 'dotenv'
dotenv.config()
import { Api } from "./api.js";
import { BinanceApi } from "./binanceApi.js";
import ccxt from 'ccxt';
import redis from 'redis';
import asincRedis from 'async-redis';


var apiKey = process.env.API_KEY;
var api = new Api(apiKey);


const originalRedisClient = redis.createClient({url: process.env.REDIS_TLS_URL}, {
    tls: {
        rejectUnauthorized: false,
        requestCert: true
    }
});
const redisClient = asincRedis.decorate(originalRedisClient);

export class CryptoAlgorithm {
    async runOnce() {

        var a = process.env;
        redisClient.on('error', function (err) {
            console.log('Could not establish a connection with redis. ' + err);
        });
        redisClient.on('connect', function (err) {
            console.log('Connected to redis successfully');
        });

        var account = await api.account();
        //console.log(account);
        const symbolsList = process.env.SYMBOLS.split(',');
      
        if(typeof account === "object" ){

            var symbolsToSell = account.symbols.filter(p => p.quantity > 0 && p.name != "USDT" );
            console.log(symbolsToSell);
            if(symbolsToSell.length > 0){
    
                for(const s of symbolsToSell){

                    var price = await api.price({symbol: s.name});
                   

                    var sHystory = await api.symbolHistory({
                        symbol: s.name,
                        interval: "1m"
                    });    

                    if(typeof sHystory === "object" && typeof price === "object"){
                        const redisOrdersString = await redisClient.lrange(s.name, 0, -1);

                        var sToSell = account.symbols.filter(p => p.name == s.name );
                        var lastRedisOrder = JSON.parse(redisOrdersString[0]);
                        var qtyToSell = lastRedisOrder.converted_quantity;
                      
                        if(redisOrdersString.length == 1){
                            var qtyToSell = sToSell.quantity;
                        }
                        
                        const currentPrice = price.value;
                        const lastOrderPrice = lastRedisOrder.price;

                        var priceDiff = currentPrice - lastOrderPrice;
                
                        if(
                            (priceDiff < 0 && await this.isLowLimit(currentPrice, lastOrderPrice, price))
                            ||
                            (priceDiff > 0 && await this.isHighLimit(currentPrice, lastOrderPrice, sHystory, price))
                        
                        ){
                            var response = await api.order({ symbol: s.name, side: 'SELL', quantity: qtyToSell });
                            console.log("SELL: " + s.name + " Qty:" + qtyToSell + " CurrentPrice:" + currentPrice + " LastOrderPrice:" + lastOrderPrice + " Profit:" +  priceDiff * qtyToSell );
                            if(typeof response === "object" &&  typeof response.order !== 'undefined' && response.order == "success"){
                                var removedOrder = await redisClient.lpop(s.name);
                                console.log("Redis POP: " + JSON.stringify(removedOrder));
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
        //console.log(account);

  

        if(typeof account === "object" ){
            var symbolsToBuy = account.symbols.filter(p => p.name != "USDT" && symbolsList.find(sl => sl === p.name));
            console.log(symbolsToBuy);
            if(account.estimatedValue > process.env.BUY_AMOUNT && symbolsToBuy.length > 0){

                for(const s of symbolsToBuy){

                    var sHystory = await api.symbolHistory({
                        symbol: s.name,
                        interval: "1m"
                    });

                    var price = await api.price({symbol: s.name});
                    console.log(price);

                   
                    
                    if(typeof sHystory === "object" && typeof price === "object" ){

                        var lastRecords = sHystory.slice(Math.max(sHystory.length - process.env.HISTORY_DEPTH, 1));

                        const currentPrice = price.value;

                        const redisOrdersString = await redisClient.lrange(s.name, 0, -1);

                        if(
                            (s.quantity == 0 && await this.isPriceRising(currentPrice, lastRecords))
                            ||
                            (s.quantity > 0 && await this.buyOnPriceFail(currentPrice, redisOrdersString, sHystory))
                        ){
                            var amountToBuy = process.env.BUY_AMOUNT;
                            //var response = {order: 'success'}
                            var response = await api.order({ symbol: s.name, side: 'BUY', quantity: amountToBuy });
                            
                            console.log("BUY: " + s.name + " ammount:" + amountToBuy + " CurrentPrice:" + currentPrice);
                            if(typeof response === "object" &&  typeof response.order !== 'undefined' && response.order == "success"){
                                var orderHistory = await api.orderHistory();

                                if(Array.isArray(orderHistory)){
                                    orderHistory.reverse();
                                    var lastOrder = orderHistory.find(o => o.symbol === s.name && o.side === "BUY");
                                    await redisClient.lpush(lastOrder.symbol, JSON.stringify(lastOrder));
                                    console.log("Redis PUSH " + JSON.stringify(lastOrder));
                                }
                                while(Array.isArray(orderHistory) == false){
                                    orderHistory = await api.orderHistory();
                                    if(Array.isArray(orderHistory) ){
                                        orderHistory.reverse();
                                        var lastOrder = orderHistory.find(o => o.symbol === s.name && o.side === "BUY");
                                        await redisClient.lpush(lastOrder.symbol, JSON.stringify(lastOrder));
                                        console.log("Redis PUSH " + JSON.stringify(lastOrder));
                                    }else{
                                        await this.sleep(10000);
                                        console.log("Sleep after error");
                                    }
                                }
                                
                            }

                        }
                    }

                }

            }
        }

        
    }

    async isPriceRising(currentPrice, lastRecords){
        console.log("isPriceRising");
        var diff = currentPrice - lastRecords[0][4];
        var lastDiff = currentPrice - lastRecords[process.env.HISTORY_DEPTH - 1][4];
        var middleDiff = currentPrice - lastRecords[process.env.HISTORY_DEPTH - process.env.RISE_HISTORY_DEPTH][4];

        console.log("currentPrice:" + currentPrice + " lastRecord: " + lastRecords[0][4] + " Rise: " + diff + " lastDiff: " + lastDiff);
        if(diff > 0 && lastDiff > 0 && middleDiff > 0){
            console.log('isPriceRising: TRUE');
            return true
        }else{
            return false
        }
    }

    async buyOnPriceFail(currentPrice, redisOrdersString, price){
        if(redisOrdersString.length == 0){
            console.log("Redis is empty!!!!!!!!");
            return false;
        }
        const lastSymbolPrices = price.slice(Math.max(price.length - process.env.RISE_HISTORY_DEPTH, 1));
        var lastRedisOrder = JSON.parse(redisOrdersString[0]);
        var priceDiff = currentPrice - lastRedisOrder.price;
        var percent = (Math.abs(priceDiff) * 100 ) / lastRedisOrder.price;
        var lastDiff = currentPrice - lastSymbolPrices[process.env.RISE_HISTORY_DEPTH - 1][4]; // Check if price start to increase after BUY_ON_FAIL_PERCENT fail
        console.log("buyOnPriceFail: " + lastRedisOrder.symbol);
        console.log("percent: " + percent);
        console.log("currentPrice: " + currentPrice);
        console.log("Last order: " + JSON.stringify(lastRedisOrder) + "isPriceRising: " + lastDiff);
        if(lastRedisOrder.price > currentPrice && percent >= process.env.BUY_ON_FAIL_PERCENT && lastDiff > 0){
            console.log('buyOnPriceFail: TRUE');
            return true;
        }
        return false;
    }

    async isLowLimit(currentPrice, buyPrice, price){
        console.log(price);
        var failPercentageLimit = process.env.LOW;
        var priceDiff = currentPrice - buyPrice;
        console.log("isLowLimit");

        if(priceDiff > 0 ){
            return false;
        }else{
            var percent = (Math.abs(priceDiff) * 100 ) / buyPrice;
            console.log("currentPrice:" + currentPrice + " buyPrice: " + buyPrice);
            console.log("envPercent:" + failPercentageLimit + " currentPercent: " + percent);
            const isLimitReached = percent > failPercentageLimit;
            return isLimitReached;
        }
    }

    async isHighLimit(currentPrice, buyPrice, symbolPriceHistory, price){
        console.log(price);
        const lastSymbolPrices = symbolPriceHistory.slice(Math.max(symbolPriceHistory.length - process.env.FAIL_HISTORY_DEPTH, 1));
        var failingDiff = currentPrice - lastSymbolPrices[process.env.FAIL_HISTORY_DEPTH - 1][4];
        var highPercentageLimit = process.env.HIGH;
        var priceDiff = currentPrice - buyPrice;
        console.log("isHighLimit");
     
        if(priceDiff < 0 ){
            return false;
        }else{
            var percent = (priceDiff * 100) / buyPrice;

            console.log("currentPrice:" + currentPrice + " buyPrice: " + buyPrice);
            console.log("envPercent:" + highPercentageLimit + " currentPercent: " + percent + " failingDiff: " + failingDiff);

            const isLimitReached = percent >= highPercentageLimit;
            const isPriceFalling = failingDiff < 0

            return isLimitReached && isPriceFalling;
        }
    }


    async sleep(ms) {
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