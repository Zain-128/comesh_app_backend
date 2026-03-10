import { Request } from 'express';

export const paginationWithAggregation = async (
  Model: any,
  req: Request,
  customQuery: object = {},
  customLookup: any = {},
  customProject: object = {},
  projection: object = {},
) => {
  try {
    let page = Number(req.query.page) || 1;
    let limit = Number(req.query.limit) || 0;

    const keyword: string = req.query.search?.toString() || '';
    const order = req.query.order?.toString() || '';
    const showAll = !!req.query.showall;
    let totalDoc = [];
    const pipeline = [];

    // Match stage
    const matchStage: any = {
      $or: [{ isDeleted: { $exists: false } }, { isDeleted: false }],
      ...customQuery,
    };
    console.log({ customQuery });

    if (showAll) {
      matchStage.isDeleted = true;
    }

    if (keyword && keyword.length >= 2) {
      matchStage.keyword = { $regex: keyword, $options: 'i' };
    }

    if (req.query.fromDate) {
      const date = new Date(req.query.fromDate as any);
      // matchStage.createdAt = { $gte: req.query.fromDate };
      matchStage.createdAt = { $gte: date };
    }

    if (req.query.toDate) {
      const date = new Date(req.query.fromDate as any);
      // matchStage.createdAt = { $lte: req.query.toDate };
      matchStage.createdAt = { $lte: date };
    }

    if (req.query.type) {
      matchStage.type = req.query.type;
    }

    pipeline.push({ $match: matchStage });

    if (customLookup.length > 0) {
      pipeline.push(...customLookup);
    }

    if (Object.keys(customProject).length > 0) {
      pipeline.push(customProject);
    }
    console.log({ pipeline });

    // totalDoc = await Model.collection.countDocuments();
    console.log(pipeline);
    totalDoc = await Model.collection
      .aggregate([
        ...pipeline,
        {
          $count: 'total',
        },
      ])
      .toArray();

    // Sort stage
    if (req.query.sort) {
      const sort = {
        [req.query.sort.toString()]: 1,
      };
      if (order.toLowerCase() === 'desc') {
        sort[req.query.sort.toString()] = -1;
      }
      pipeline.push({ $sort: sort });
    }

    // Setting page and limit if not provided
    if (page > 0 && limit === 0) {
      limit = 10;
    }

    if (limit > 0 && page === 0) {
      page = 1;
    }

    // Pagination stages
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    pipeline.push({ $skip: startIndex }, { $limit: limit });

    const result = await Model.collection.aggregate(pipeline).toArray();

    const paginatedData = result;
    // const totalCount = result.length > 0 ? totalDoc : 0;
    const totalCount = result.length > 0 ? totalDoc[0].total : 0;

    console.log({ totalCount, limit });
    // Calculate pagination values
    const lastPage = Math.ceil(totalCount / limit);
    const hasNext = endIndex < totalCount;
    const hasPrevious = startIndex > 0;

    // Build the pagination object
    const pagination = {
      totalRecords: totalCount,
      limit,
      current: page,
      totalPages: lastPage,
      hasNext,
      hasPrevious,
      cursor: {},
    };

    return { pagination, data: paginatedData };
  } catch (err) {
    console.log(err);
    throw new Error('Something went wrong with pagination');
  }
};
