const Payment = require("../../model/payment/payment");
const Order = require("../../model/cart/order");
const Cart = require("../../model/cart/cart");
const ItemBook = require("../../model/book/item_book");
function sortObject(obj) {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}
module.exports = {
  async createPayment(req, res, next) {
    const { order } = req.body;
    if (!order) {
      res.status(401).json({
        status: "error",
        message: "You must be send user before creating payment",
      });
    } else {
      const o = await Order.findById(order).populate("cart").lean();
      const payment = await Payment.findById(o._id).lean();
      console.log(o);
      if (payment) {
        res.status(403).json({ message: "Payment has already", status: false });
      } else {
        const ipAddr = req.headers["x-forwarded-for"];
        let dateFormat = require("dateformat");

        let tmnCode = process.env.vnp_TmnCode;
        let secretKey = process.env.vnp_HashSecret;
        let vnpUrl = process.env.vnp_Url;
        let returnUrl = process.env.vnp_ReturnUrl;

        let date = new Date();

        let createDate = dateFormat(date, "yyyymmddHHmmss");
        let orderId = dateFormat(date, "HHmmss");
        let bankCode = req.body.bankCode;

        let orderInfo = `Payment for this cart`;
        let orderType = "pay";
        let locale = req.body.language;
        if (locale === null || locale === "") {
          locale = "vn";
        }
        let currCode = "VND";
        let vnp_Params = {};
        vnp_Params["vnp_Version"] = "2.1.0";
        vnp_Params["vnp_Command"] = "pay";
        vnp_Params["vnp_TmnCode"] = tmnCode;
        // vnp_Params['vnp_Merchant'] = ''
        vnp_Params["vnp_Locale"] = locale || "vi";
        vnp_Params["vnp_CurrCode"] = currCode;
        vnp_Params["vnp_TxnRef"] = orderId;
        vnp_Params["vnp_OrderInfo"] = orderInfo;
        vnp_Params["vnp_OrderType"] = orderType;
        vnp_Params["vnp_Amount"] = o.cart.total_price * 100;
        vnp_Params["vnp_ReturnUrl"] = returnUrl;
        vnp_Params["vnp_IpAddr"] = ipAddr;
        vnp_Params["vnp_CreateDate"] = createDate;
        if (bankCode !== null && bankCode !== "") {
          vnp_Params["vnp_BankCode"] = "NCB";
        }
        vnp_Params = sortObject(vnp_Params);

        let querystring = require("qs");
        let signData = querystring.stringify(vnp_Params, { encode: false });
        let crypto = require("crypto");
        let hmac = crypto.createHmac("sha512", secretKey);
        let signed = hmac.update(new Buffer(signData, "utf-8")).digest("hex");
        vnp_Params["vnp_SecureHash"] = signed;
        vnpUrl += "?" + querystring.stringify(vnp_Params, { encode: false });
        const dataPayment = new Payment({
          order: o,
          bank_code: bankCode,
          transaction_no: orderId,
        });
        dataPayment.save();
        res.status(200).json({
          message: "create payment transaction successfully",
          url: vnpUrl,
          status: true,
        });
      }
    }
  },
  async getPayment(req, res, next) {
    var vnp_Params = req.query;
    var secureHash = vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHashType"];

    vnp_Params = sortObject(vnp_Params);
    var secretKey = process.env.vnp_HashSecret;
    var querystring = require("qs");
    var signData = querystring.stringify(vnp_Params, { encode: false });
    var crypto = require("crypto");
    var hmac = crypto.createHmac("sha512", secretKey);
    var signed = hmac.update(new Buffer(signData, "utf-8")).digest("hex");

    const p = await Payment.findOne({
      transaction_no: vnp_Params["vnp_TxnRef"],
    }).populate("order");
    await Order.findByIdAndUpdate(p.order._id, { is_payment: true }).lean();

    // await ItemBook.findByIdAndUpdate();
    if (secureHash === signed) {
      var orderId = vnp_Params["vnp_TxnRef"];
      var rspCode = vnp_Params["vnp_ResponseCode"];
      if (rspCode !== "00") {
        res.json({
          status: "Faild to payment",
          response_code: rspCode,
        });
      } else {
        const o = await Order.findById(p.order._id).populate("cart").lean();
        console.log(o);
        for (let [idx, item] of o.cart.item_book.entries()) {
          const it = await ItemBook.findById(item).lean();
          await ItemBook.findByIdAndUpdate(item, {
            amount: it.amount - o.cart.quantity[idx],
          });
        }
        res.redirect('/')
        // res.json({
        //   status: "success",
        //   message: "You have been successfully to payment for this order",
        //   order: orderId,
        //   response_code: rspCode,
        // });
      }
    } else {
      res.status(200).json({ RspCode: "97", Message: "Fail checksum" });
    }
  },
};
