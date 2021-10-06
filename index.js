// require('dotenv').config();

BINANCE_API_KEY='WfNqKoVr5X9JGa7JENr02uBC0tnGIgEUFZNB6jfsiTJu2gaWAZKa4DfUIntWoAvI'
BINANCE_API_SECRET='8Ykjk33W9KpJ39PJuZfx9bBMz1cVpu18UkAwBzHLWdXafezMXILQmwH4NRGUEPnM'

const ccxt = require('ccxt');
const axios = require('axios');
const readlineSync = require('readline-sync')

let marketPrice;

const tick = async (config, binanceClient) => {

    const { tradingCurrency, baseCurrency, difference, tradingAmount } = config;
    const market = `${tradingCurrency}/${baseCurrency}`;  // market key
    
    // Get actual market price using coingecko API
    
    // Cancel orders of previous tick
    const orders = await binanceClient.fetchOpenOrders(market);
    console.log("open orders:")
    orders.forEach(order => {
        console.log(order)
        // await binanceClient.cancelOrder(order.id);
    });

    // new orders config
    const sellPrice = marketPrice * (1 + difference);
    const balances = await binanceClient.fetchBalance();
    const tradingCurrencyBalance = balances.free[tradingCurrency] || 0;
    const baseCurrencyBalance = balances.free[baseCurrency] || 0;

    console.log("Balance: ", tradingCurrency, tradingCurrencyBalance, baseCurrency, baseCurrencyBalance)

    // Create limit sell order
    const order = await binanceClient.createLimitSellOrder(market, tradingAmount, sellPrice);
    console.log(order)
    console.log(`
        New tick for ${market}...
        Created Limit sell order for ${tradingAmount}@${sellPrice}
    `);

}

const buyTradingCrypto = async ({ buyingAmount, baseCurrency, tradingCurrency }, binanceClient) => {
    if( buyingAmount ) {
        marketPrice = await getMarketPrice({baseCurrency, tradingCurrency}, binanceClient)
        const symbol = `${tradingCurrency}/${baseCurrency}`
        try{
            const order = await binanceClient.createOrder(symbol, 'market', 'buy', buyingAmount/marketPrice, marketPrice)
            console.log(order)
            marketPrice = order.price
            return order.amount
        }catch (e){
            console.error(e)
        }
    }
    return 0
}

const getMarketPrice = async ({tradingCurrency, baseCurrency}, binanceClient) => {
    // Get actual market price using coingecko API
    const symbol = `${tradingCurrency}${baseCurrency}`
    const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`)
    console.log(response.data)
    return parseFloat(response.data.price)
}

const run = async () => {
    // const marketPrice = await getMarketPrice()
    const baseCurrency = await readlineSync.question("Enter Base Currency (e.g. USDT)\n")
    const buyingAmount = await readlineSync.question("Enter amount of Trading Currency (e.g. 1,000)\n")
    const difference = await readlineSync.question("Enter a price difference in % (e.g. 20)\n")
    const tradingCurrency = await readlineSync.question("Enter the Trading Currency (e.g. BTC)\n")

    const config = {
        baseCurrency,       // Trading crypto
        tradingCurrency,       // Trading against
        buyingAmount: parseFloat(buyingAmount),    // % of money in portfolio for each trade
        difference: parseFloat(difference) / 100.0,        // % for Buy and sell limit order
    }

    // Instantiate binance client
    const binanceClient = new ccxt.binance({
        apiKey: BINANCE_API_KEY,
        secret: BINANCE_API_SECRET,
        options: {
            adjustForTimeDifference: true
        }
    });

    const tradingAmount = await buyTradingCrypto(config, binanceClient)
    if ( tradingAmount == 0 ){
        console.error('buying trading crypto failed')
        return
    }
    config.tradingAmount = tradingAmount

    await tick(config, binanceClient);

}

// Execute bot
run();