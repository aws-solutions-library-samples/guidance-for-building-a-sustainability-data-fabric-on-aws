/**
 *  If you need to include a specific transform recipe or ruleset, specify it here.
 */
export const assetToConfigurationMap = {
	'purchased_goods_and_services': {
		dataQuality: {
			ruleset: `Rules = [ ColumnValues "currencycode" in [ "USD" ], IsComplete "materialcode"]`
		}
	}
};
