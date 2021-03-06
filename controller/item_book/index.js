const Book = require("../../model/book/book");
const ItemBook = require("../../model/book/item_book");

module.exports = {
  async createItemBook(req, res, next) {
    try {
      const tmp = await req.body;

      const dataItemBook = {
        amount: tmp.amount,
        price: tmp.price,
        book: tmp.book,
      };
      if (tmp.amount < 0) {
        res.status(403).json({ message: "amount > 0" });
      } else {
        const itemBook = new ItemBook(dataItemBook);
        await itemBook.save();
        res.json({
          message: "ItemBook created successfully",
          data: dataItemBook,
        });
      }
    } catch (error) {
      res.status(403).json({ message: error.message });
    }
  },

  async getItemBook(req, res, next) {
    try {
      let response;
      const {keysearch, item_id} = req.query;
      if(keysearch) {
        const book = await Book.findOne({title: {$regex: keysearch, $options: "$i"}})
        response = await ItemBook.find(({book: book._id}));
      } 
      else if(item_id) {
        response = await ItemBook.find(({_id: item_id}));
      }
      else {
        response = await ItemBook.find();
      }
      const itemBooks = [];
      for ([idx, item] of response.entries()) {
        const book = await Book.findById(item.book, "-__v")
          .populate("author", "-__v ")
          .populate("publisher", "-__v")
          .populate("category", "-__v")
          .lean();

        const value = {
          _id: item._id,
          price: item.price,
          amount: item.amount,
          book,
        };
        itemBooks.push(value);
      }
      res.json({
        data: itemBooks,
      });
    } catch (error) {
      res.status.json(error);
    }
  },

  async deleteItemBook(req, res, next) {
    try {
      const {id} = await req.body;
      const itemBook = await ItemBook.findById(id).populate("book").lean();
      console.log(itemBook);
      if (itemBook) {
        await Book.findByIdAndUpdate(itemBook.book, {
          is_active: false,
        }).lean();
        res.status(200).json({ message: "Delete itembook successfully" });
      } else {
        res.status(403).json({
          message: "Book not found ",
        });
      }
    } catch (error) {
      res.status(403).json(error);
    }
  },
};
