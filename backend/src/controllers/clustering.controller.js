import clusteringService from "../services/clustering.service.js";

export async function getTopicClusters(req, res, next) {
  try {
    const result = await clusteringService.getTopicClusters();
    res.json(result);
  } catch (err) { next(err); }
}

export async function getEscalationFlow(req, res, next) {
  try {
    const result = await clusteringService.getEscalationFlow();
    res.json(result);
  } catch (err) { next(err); }
}
