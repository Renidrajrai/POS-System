import db from './knex.js'

export async function ensureTables() {
  if (!(await db.schema.hasTable('StaffAttendance'))) {
    await db.schema.createTable('StaffAttendance', table => {
      table.increments('Id').primary()
      table.integer('StaffId').notNullable().references('Id').inTable('Staff').onDelete('CASCADE')
      table.date('Date').notNullable()
      table.string('ScheduledShift', 10)
      table.string('Status', 20).defaultTo('Absent')
      table.time('ClockIn')
      table.time('ClockOut')
      table.integer('OvertimeMinutes').defaultTo(0)
      table.string('LeaveType', 30)
      table.text('LeaveReason')
      table.integer('ReplacementStaffId').references('Id').inTable('Staff')
      table.text('Notes')
      table.unique(['StaffId', 'Date'])
    })
  }

  if (!(await db.schema.hasTable('MenuModifiers'))) {
    await db.schema.createTable('MenuModifiers', table => {
      table.increments('Id').primary()
      table.integer('MenuItemId').notNullable().references('Id').inTable('MenuItems').onDelete('CASCADE')
      table.string('Name').notNullable()
      table.string('Type', 20).notNullable().defaultTo('select')
      table.boolean('IsRequired').defaultTo(false)
      table.integer('DisplayOrder').defaultTo(0)
    })
  }

  if (!(await db.schema.hasTable('MenuModifierOptions'))) {
    await db.schema.createTable('MenuModifierOptions', table => {
      table.increments('Id').primary()
      table.integer('ModifierId').notNullable().references('Id').inTable('MenuModifiers').onDelete('CASCADE')
      table.string('Name').notNullable()
      table.decimal('PriceAdjustment', 10, 2).defaultTo(0)
      table.integer('DisplayOrder').defaultTo(0)
    })
  }

  if (!(await db.schema.hasTable('RecipeIngredients'))) {
    await db.schema.createTable('RecipeIngredients', table => {
      table.increments('Id').primary()
      table.integer('MenuItemId').notNullable().references('Id').inTable('MenuItems').onDelete('CASCADE')
      table.string('IngredientName').notNullable()
      table.decimal('Quantity', 10, 3).notNullable().defaultTo(0)
      table.string('Unit', 30).notNullable().defaultTo('g')
      table.decimal('CostPerUnit', 10, 2).defaultTo(0)
      table.integer('DisplayOrder').defaultTo(0)
    })
  }

  if (!(await db.schema.hasTable('Suppliers'))) {
    await db.schema.createTable('Suppliers', table => {
      table.increments('Id').primary()
      table.string('Name').notNullable()
      table.string('ContactPerson')
      table.string('Phone')
      table.string('Email')
      table.text('Address')
      table.string('Status', 20).defaultTo('Active')
      table.timestamp('CreatedAt').defaultTo(db.fn.now())
    })
  }

  if (!(await db.schema.hasTable('PurchaseOrders'))) {
    await db.schema.createTable('PurchaseOrders', table => {
      table.increments('Id').primary()
      table.integer('SupplierId').notNullable().references('Id').inTable('Suppliers')
      table.string('OrderNumber').notNullable().unique()
      table.string('Status', 30).defaultTo('Draft')
      table.date('OrderDate').defaultTo(db.fn.now())
      table.date('ExpectedDate')
      table.decimal('TotalAmount', 12, 2).defaultTo(0)
      table.text('Notes')
      table.timestamp('CreatedAt').defaultTo(db.fn.now())
    })
  }

  if (!(await db.schema.hasTable('PurchaseOrderItems'))) {
    await db.schema.createTable('PurchaseOrderItems', table => {
      table.increments('Id').primary()
      table.integer('PurchaseOrderId').notNullable().references('Id').inTable('PurchaseOrders').onDelete('CASCADE')
      table.string('ItemName').notNullable()
      table.decimal('Quantity', 10, 3).notNullable()
      table.string('Unit', 30)
      table.decimal('UnitPrice', 10, 2).defaultTo(0)
      table.decimal('TotalPrice', 12, 2).defaultTo(0)
    })
  }

  if (!(await db.schema.hasTable('GoodsReceipts'))) {
    await db.schema.createTable('GoodsReceipts', table => {
      table.increments('Id').primary()
      table.integer('PurchaseOrderId').notNullable().references('Id').inTable('PurchaseOrders')
      table.date('ReceiptDate').defaultTo(db.fn.now())
      table.string('Status', 30).defaultTo('Completed')
      table.text('Notes')
      table.timestamp('CreatedAt').defaultTo(db.fn.now())
    })
  }

  if (!(await db.schema.hasTable('GoodsReceiptItems'))) {
    await db.schema.createTable('GoodsReceiptItems', table => {
      table.increments('Id').primary()
      table.integer('GoodsReceiptId').notNullable().references('Id').inTable('GoodsReceipts').onDelete('CASCADE')
      table.integer('PurchaseOrderItemId').notNullable().references('Id').inTable('PurchaseOrderItems')
      table.decimal('ReceivedQuantity', 10, 3).notNullable()
      table.decimal('AcceptedQuantity', 10, 3)
    })
  }

  if (!(await db.schema.hasTable('OrderRefunds'))) {
    await db.schema.createTable('OrderRefunds', table => {
      table.increments('Id').primary()
      table.integer('OrderId').notNullable().references('Id').inTable('Orders')
      table.decimal('Amount', 10, 2).notNullable()
      table.text('Reason')
      table.string('Status', 20).defaultTo('Refunded')
      table.timestamp('CreatedAt').defaultTo(db.fn.now())
    })
  }

  if (!(await db.schema.hasTable('OnlineOrders'))) {
    await db.schema.createTable('OnlineOrders', table => {
      table.increments('Id').primary()
      table.integer('OrderId').references('Id').inTable('Orders')
      table.string('CustomerName').notNullable()
      table.string('CustomerPhone')
      table.text('DeliveryAddress')
      table.jsonb('Items').notNullable()
      table.decimal('TotalAmount', 10, 2).notNullable()
      table.string('Status', 30).defaultTo('Pending')
      table.string('OrderType', 20).defaultTo('Pickup')
      table.text('Notes')
      table.timestamp('CreatedAt').defaultTo(db.fn.now())
    })
  }
}
