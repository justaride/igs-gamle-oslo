function column(alias: string, name: string) {
  return `${alias}.${name}`
}

export function buildSiteSql(alias = 's') {
  const col = (name: string) => column(alias, name)

  const effectiveGeom = `COALESCE(${col('manual_geometry')}, ${col('geom')})`
  const effectiveIgsType = `COALESCE(${col('manual_igs_type')}, ${col('igs_type')})`
  const effectiveSubtype = `COALESCE(${col('manual_subtype')}, ${col('subtype')})`
  const effectiveStatus = `COALESCE(${col('manual_status')}, ${col('status')})`
  const effectiveName = `COALESCE(${col('manual_name')}, ${col('name')})`
  const effectiveOwnership = `COALESCE(${col('manual_ownership')}, ${col('ownership')})`
  const effectiveAccessControl = `COALESCE(${col('manual_access_control')}, ${col('access_control')})`
  const effectiveAccessDescription = `COALESCE(${col('manual_access_description')}, ${col('access_description')})`
  const effectiveNaturalBarrier = `COALESCE(${col('manual_natural_barrier')}, ${col('natural_barrier')})`
  const effectiveMaintenance = `COALESCE(${col('manual_maintenance')}, ${col('maintenance')})`
  const effectiveMaintenanceFrequency = `COALESCE(${col('manual_maintenance_frequency')}, ${col('maintenance_frequency')})`
  const effectiveProxHousing = `COALESCE(${col('manual_prox_housing')}, ${col('prox_housing')})`
  const effectiveHiddenGem = `COALESCE(${col('manual_hidden_gem')}, ${col('hidden_gem')})`
  const effectiveDangerous = `COALESCE(${col('manual_dangerous')}, ${col('dangerous')})`
  const effectiveNoisy = `COALESCE(${col('manual_noisy')}, ${col('noisy')})`
  const effectiveTooSmall = `COALESCE(${col('manual_too_small')}, ${col('too_small')})`
  const effectiveNotes = `COALESCE(${col('manual_notes')}, ${col('editor_notes')}, ${col('notes')})`
  const effectiveBuriedRiver = `COALESCE(${col('manual_buried_river')}, ${col('buried_river')})`
  const effectiveCommunityActivityPotential = `COALESCE(${col('manual_community_activity_potential')}, ${col('community_activity_potential')})`
  const effectiveBiodiversityPotential = `COALESCE(${col('manual_biodiversity_potential')}, ${col('biodiversity_potential')})`
  const effectiveArea = `
    CASE
      WHEN ${col('manual_geometry')} IS NOT NULL
        THEN ST_Area(ST_Transform(${col('manual_geometry')}, 25833))
      ELSE ${col('area_m2')}
    END
  `
  const effectiveGoodOpportunity = `
    (
      ${effectiveOwnership} IN ('PUB', 'UNK')
      AND ${effectiveAccessControl} IN ('O', 'P')
      AND (NOT COALESCE(${effectiveDangerous}, false))
      AND (NOT COALESCE(${effectiveNoisy}, false))
      AND (NOT COALESCE(${effectiveTooSmall}, false))
    )
  `
  const activeSite = `
    (
      ${col('source_present')} = TRUE
      OR ${col('manual_override')} = TRUE
      OR ${effectiveStatus} <> 'candidate'
    )
  `

  return {
    activeSite,
    effectiveAccessControl,
    effectiveAccessDescription,
    effectiveArea,
    effectiveBiodiversityPotential,
    effectiveBuriedRiver,
    effectiveCommunityActivityPotential,
    effectiveDangerous,
    effectiveGeom,
    effectiveGoodOpportunity,
    effectiveHiddenGem,
    effectiveIgsType,
    effectiveMaintenance,
    effectiveMaintenanceFrequency,
    effectiveName,
    effectiveNaturalBarrier,
    effectiveNoisy,
    effectiveNotes,
    effectiveOwnership,
    effectiveProxHousing,
    effectiveStatus,
    effectiveSubtype,
    effectiveTooSmall,
  }
}
