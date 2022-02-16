import chai from 'chai'
import { Service, Request, Response, Validate, ValidationCondition } from '../lib'
import server from './fixtures'
import buildFakeRequest from './buildFakeRequest'

const expect = chai.expect

describe('@Validate hook object schema', () => {
  after(() => {
    server.close()
  })

  it('should return a single error for a missing required property', async () => {
    class SearchService implements Service {
      @Validate({
        query: {
          search: {
            required: true
          },
          itemsPerPage: {
            required: true
          }
        }
      })
      async index(req: Request): Promise<Response> {
        return { status: 204 }
      }
    }

    const res = await new SearchService().index(buildFakeRequest({
      query: {
        itemsPerPage: '5'
      }
    }))

    expect(res.status).to.equal(400)

    expect(res.body.errors).to.have.key('search')
    expect(res.body.errors).to.not.have.key('itemsPerPage')
    expect(res.body.errors.search).to.eql(['search is missing from the request query'])
  })

  it('should return a multiple errors for multiple missing properties', async () => {
    class SearchService implements Service {
      @Validate({
        query: {
          search: {
            required: true
          },
          itemsPerPage: {
            required: true
          }
        }
      })
      async index(req: Request): Promise<Response> {
        return { status: 204 }
      }
    }

    const res = await new SearchService().index(buildFakeRequest())

    expect(res.status).to.equal(400)
    expect(res.body.errors).to.have.keys(['search', 'itemsPerPage'])

    expect(res.body.errors.search).to.eql(['search is missing from the request query'])
    expect(res.body.errors.itemsPerPage).to.eql(['itemsPerPage is missing from the request query'])
  })

  it('should return an error for a key with a requiredIf that resolves to true', async () => {
    class SearchService implements Service {
      @Validate({
        query: {
          search: {
            required: true
          },
          itemsPerPage: {
            requiredIf: async (req: Request) => Boolean(req.query.search)
          }
        }
      })
      async index(req: Request): Promise<Response> {
        return { status: 204 }
      }
    }

    const res = await new SearchService().index(buildFakeRequest({
      query: {
        search: 'abc'
      }
    }))

    expect(res.status).to.equal(400)
    expect(res.body.errors).to.have.keys(['itemsPerPage'])
    expect(res.body.errors.itemsPerPage).to.eql(['itemsPerPage is missing from the request query'])
  })

  it('should not return an error for a key with a requiredIf that resolves to false', async () => {
    class SearchService implements Service {
      @Validate({
        query: {
          search: {
            required: true
          },
          itemsPerPage: {
            requiredIf: async (req: Request) => Boolean(req.query.paginate)
          }
        }
      })
      async index(req: Request): Promise<Response> {
        return { status: 204 }
      }
    }

    const res = await new SearchService().index(buildFakeRequest({
      query: {
        search: 'abc'
      }
    }))

    expect(res.status).to.equal(204)
  })

  it('should only return errors for null or undefined values', async () => {
    class SearchService implements Service {
      @Validate({
        query: {
          search: {
            required: true
          }
        }
      })
      async index(req: Request): Promise<Response> {
        return { status: 204 }
      }
    }

    const res = await new SearchService().index(buildFakeRequest({
      query: {
        search: ''
      }
    }))

    expect(res.status).to.equal(204)
  })

  it('should return custom errors for required properties', async () => {
    class SearchService implements Service {
      @Validate({
        query: {
          search: {
            required: true,
            error: 'You must provide a search query'
          },
          itemsPerPage: {
            requiredIf: async (req: Request) => Boolean(req.query.paginate),
            error: 'You must provide an itemsPerPage when pagination is enabled'
          }
        }
      })
      async index(req: Request): Promise<Response> {
        return { status: 204 }
      }
    }

    const res = await new SearchService().index(buildFakeRequest({
      query: {
        paginate: true
      }
    }))

    expect(res.status).to.equal(400)
    expect(res.body.errors).to.have.keys(['search', 'itemsPerPage'])

    expect(res.body.errors.search).to.eql(['You must provide a search query'])
    expect(res.body.errors.itemsPerPage).to.eql(['You must provide an itemsPerPage when pagination is enabled'])
  })

  it('should return an error if a validation check is not met', async () => {
    class SearchService implements Service {
      @Validate({
        query: {
          itemsPerPage: {
            required: true,
            validation: async (val: unknown): Promise<ValidationCondition[]> => [{
              check: !isNaN(val as number)
            }]
          }
        }
      })
      async index(req: Request): Promise<Response> {
        return { status: 204 }
      }
    }

    const res = await new SearchService().index(buildFakeRequest({
      query: {
        itemsPerPage: 'i would like 25 please'
      }
    }))

    expect(res.status).to.equal(400)

    expect(res.body.errors).to.have.key('itemsPerPage')
    expect(res.body.errors.itemsPerPage).to.eql(['The provided itemsPerPage value is invalid'])
  })

  it('should not return an error if a validation check is not met on a missing property', async () => {
    class SearchService implements Service {
      @Validate({
        query: {
          itemsPerPage: {
            validation: async (val: unknown): Promise<ValidationCondition[]> => [{
              check: !isNaN(val as number)
            }]
          }
        }
      })
      async index(req: Request): Promise<Response> {
        return { status: 204 }
      }
    }

    const res = await new SearchService().index(buildFakeRequest())
    expect(res.status).to.equal(204)
  })

  it('should return all validation errors for a property', async () => {
    class SearchService implements Service {
      @Validate({
        query: {
          itemsPerPage: {
            validation: async (val: number): Promise<ValidationCondition[]> => [
              {
                check: val > 1,
                error: 'itemsPerPage must be greater than 1'
              },
              {
                check: val > 0,
                error: 'itemsPerPage must be positive'
              }
            ]
          }
        }
      })
      async index(req: Request): Promise<Response> {
        return { status: 204 }
      }
    }

    const res = await new SearchService().index(buildFakeRequest({
      query: {
        itemsPerPage: -1
      }
    }))

    expect(res.status).to.equal(400)

    expect(res.body.errors.itemsPerPage).to.eql([
      'itemsPerPage must be greater than 1',
      'itemsPerPage must be positive'
    ])
  })
})
