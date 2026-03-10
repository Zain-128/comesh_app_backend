import { Request } from 'express';

export const pagination = async (
  Model: any,
  req: Request,
  customQuery: object = {},
  projection: object = {},
  populateFields: object[] = [],
) => {
  try {
    let query;
    let page = Number(req.query.page) || 0;
    let limit = Number(req.query.limit) || 0;
    const keyword: string = req.query.search?.toString() || '';
    let totalDoc = 0;
    let results: any = {};
    const order = req.query.order?.toString() || '';
    let showAll = false;
    showAll = !!req.query.showall;

    query = Model.collection;

    const searchQuery: any = {
      $or: [{ isDeleted: { $exists: false } }, { isDeleted: false }],
      ...customQuery,
    };

    if (showAll) {
      searchQuery.isDeleted = true;
    }

    // Searching with keywords
    if (keyword && keyword.length >= 2) {
      searchQuery.keyword = { $regex: keyword, $options: 'i' };
    }

    if (req.query.fromDate) {
      searchQuery.createdAt = { $gte: req.query.fromDate };
    }

    if (req.query.toDate) {
      searchQuery.createdAt = { $lte: req.query.toDate };
    }

    if (req.query.type) {
      searchQuery.type = req.query.type;
    }

    query = await query.find(searchQuery, { projection });

    for (const field of populateFields) {
      query = query.populate(field);
    }

    totalDoc = await Model.collection.countDocuments(searchQuery);

    // Setting page and limit if not provided
    if (page > 0 && limit === 0) {
      limit = 10;
    }

    if (limit > 0 && page === 0) {
      page = 1;
    }

    // Pagination values setup
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const lastPage = Math.ceil(totalDoc / limit);

    // limit and skip records
    query = query.limit(limit).skip(startIndex);

    if (req.query.sort) {
      const sort = {
        [req.query.sort.toString()]: 1,
      };
      if (order.toLowerCase() === 'desc') {
        sort[req.query.sort.toString()] = -1;
      }

      query = query.sort(sort);
    }

    // Pagination
    results = {
      totalRecords: totalDoc,
    };

    if (page > 0 && limit > 0) {
      results.limit = limit;
      results.current = page;
      results.totalPages = lastPage;
      results.hasNext = false;
      results.hasPrevious = false;
      results.cursor = {};

      // Check for next page
      if (endIndex < totalDoc) {
        results.hasNext = true;
      }

      // Check for previous page
      if (startIndex > 0) {
        results.hasPrevious = true;
      }
    }

    const pagination = results;
    const data = await query.toArray();

    return { pagination, data };
  } catch (err) {
    throw new Error('Something went wrong with pagination');
  }
};
