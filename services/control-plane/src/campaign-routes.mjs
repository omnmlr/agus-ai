import { idempotencyRecord } from './idempotency.mjs';
import { missing } from './pilot-policy.mjs';
import {
  campaignReport, campaignView, changeCampaign, contributorTransition, listAssignments, ownCampaign,
  refreshCampaigns, reviewSubmission, saveCampaign, sendSubmission,
} from './campaigns.mjs';
import { appealQualification, qualificationView, submitQualification } from './qualifications.mjs';

const personResources = ['qualifications', 'assignments', 'campaign-earnings'];

export function isCampaignRoute(route) {
  return ['campaigns', 'assignments'].includes(route[0]) ||
    (route[0] === 'me' && personResources.includes(route[1]));
}

export function campaignRoute(state, user, route, method, input, config, now, requestKey) {
  refreshCampaigns(state, now);
  const [resource, id, operation, suffix] = route;
  if (resource === 'campaigns') {
    if (!id && method === 'GET') {
      return { campaigns: Object.values(state.campaigns).filter(entry => entry.ownerId === user.id)
        .slice(-50).reverse().map(campaignView) };
    }
    if (!id && method === 'POST') {
      const record = idempotencyRecord({ state, user, route: 'campaigns', rawKey: requestKey, body: input,
        now, secret: config.idempotencySecret });
      if (record.previousId) return { campaign: campaignView(ownCampaign(state, user, record.previousId)) };
      const result = saveCampaign(state, user, input, config, now);
      record.store(result.campaign.id);
      return result;
    }
    if (id && !operation && method === 'GET') return { campaign: campaignView(ownCampaign(state, user, id)) };
    if (id && !operation && method === 'PATCH') return saveCampaign(state, user, input, config, now, id);
    if (id && !suffix && method === 'GET' && operation === 'report') return campaignReport(state, user, id, now);
    if (id && !suffix && method === 'POST' && ['launch', 'pause', 'resume', 'cancel', 'complete'].includes(operation)) {
      return changeCampaign(state, user, id, operation, input, config, now);
    }
  }
  if (resource === 'assignments' && id && !suffix && method === 'POST') {
    if (operation === 'submissions') return sendSubmission(state, user, id, input, now);
    if (operation === 'reviews') return reviewSubmission(state, user, id, input, now);
  }
  if (resource === 'me' && id === 'qualifications') {
    if (!operation && method === 'GET') return qualificationView(state, user, now);
    if (operation && method === 'POST' && suffix === 'submissions') return submitQualification(state, user, operation, input, now);
    if (operation && method === 'POST' && suffix === 'appeal') return appealQualification(state, user, operation, input, now);
  }
  if (resource === 'me' && id === 'assignments') {
    if (!operation && method === 'GET') return listAssignments(state, user, now);
    if (operation && suffix && method === 'POST') return contributorTransition(state, user, operation, suffix, input, now);
  }
  if (resource === 'me' && id === 'campaign-earnings' && !operation && method === 'GET') {
    const obligations = Object.values(state.compensation).filter(entry => entry.contributorId === user.id);
    return { earnings: { asset: 'TEST_UNITS', transferable: false,
      testUnits: obligations.reduce((sum, entry) => sum + entry.testUnits, 0),
      records: obligations.map(({ id, assignmentId, testUnits, acceptedAt, state }) => ({ id, assignmentId, testUnits, acceptedAt, state })) } };
  }
  missing(false, 'Route');
}
