const OrderRevision = require('../models/OrderRevision');

class OrderRevisionService {
  /**
   * Erstellt einen Revisionsdatensatz für eine Auftragsänderung (Historisierung)
   */
  static async recordRevision(order, {
    triggerReason = 'manual_edit',
    previousGrossAmount = null,
    changedBy = null,
    changedByName = 'System',
    notes = ''
  } = {}) {
    try {
      if (!order || !order._id) return null;

      const prevGross = previousGrossAmount != null
        ? Number(previousGrossAmount)
        : Number(order.originalGrossAmount != null ? order.originalGrossAmount : (order.totalCost || 0));
      const newGross = Number(order.totalCost || 0);
      const delta = Number((newGross - prevGross).toFixed(2));

      const count = await OrderRevision.countDocuments({ orderId: order._id });
      const revisionNumber = count + 1;

      const snapshotItems = [
        ...(Array.isArray(order.services) ? order.services : []).map((s) => ({
          type: 'service',
          name: typeof s === 'string' ? s : (s.name || s.description || 'Service'),
          price: s.price || 0
        })),
        ...(Array.isArray(order.addOns) ? order.addOns : []).map((a) => ({
          type: 'addon',
          name: a.name,
          price: a.price || 0
        })),
        ...(Array.isArray(order.shopProducts) ? order.shopProducts : []).map((p) => ({
          type: 'product',
          productId: p.productId,
          quantity: p.quantity,
          priceAtOrder: p.priceAtOrder
        }))
      ];

      const revision = new OrderRevision({
        orderId: order._id,
        revisionNumber,
        triggerReason,
        previousGrossAmount: prevGross,
        newGrossAmount: newGross,
        deltaGrossAmount: delta,
        snapshotItems,
        changedBy: changedBy || undefined,
        changedByName,
        notes
      });

      await revision.save();

      order.revisionCount = revisionNumber;
      if (order.constructor && typeof order.constructor.updateOne === 'function') {
        await order.constructor.updateOne({ _id: order._id }, { $set: { revisionCount: revisionNumber } });
      }

      return revision;
    } catch (err) {
      console.error('OrderRevisionService: Error recording order revision:', err);
      return null;
    }
  }

  /**
   * Lädt alle Revisionen eines Auftrags in chronologischer Reihenfolge
   */
  static async getOrderRevisions(orderId) {
    return OrderRevision.find({ orderId }).sort({ revisionNumber: 1 }).lean();
  }
}

module.exports = OrderRevisionService;
